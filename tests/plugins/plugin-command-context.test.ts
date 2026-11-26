import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandRegistry } from "../../src/application/extensions/CommandRegistry.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { PluginHost } from "../../src/host/PluginHost.js";
import type {
  CommandProvider,
  EditorCommandContext
} from "../../src/plugin-api/index.js";

describe("plugin command context", () => {
  it("exposes document state through a read-only command context", () => {
    const commands = new CommandRegistry<EditorSession>();
    const host = new PluginHost({
      shapes: new ShapeFactory(),
      commands,
      decorators: new TreeDecoratorRegistry(),
      attributes: new AttributeHandlerRegistry()
    });
    const provider: CommandProvider<EditorCommandContext> = {
      name: "document-count",
      usage: "document-count",
      create() {
        return {
          kind: "query",
          validate(): void {},
          execute(context) {
            return {
              success: true,
              message: String(context.document?.shapeCount ?? 0),
              affectedIds: []
            };
          }
        };
      }
    };

    expect(
      host.activate(
        {
          activate(context): void {
            context.registerCommand(provider);
          }
        },
        {
          name: "@fixture/document-count",
          contributes: { commands: ["document-count"] }
        }
      )
    ).toEqual({ success: true });

    const session = new EditorSession();
    const document = session.initializeCanvas(100, 100);
    document.addShape(
      new Rect({ id: "rect", x: 0, y: 0, width: 10, height: 10 })
    );
    const command = commands.create("document-count", []);
    if (command.kind === "edit") {
      throw new Error("fixture command must be non-editable");
    }
    command.validate(session);

    expect(command.execute(session).message).toBe("1");
  });
});
