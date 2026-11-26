import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { SetAttributeCommandProvider } from "../../src/application/commands/SetAttributeCommandProvider.js";
import type {
  AttributeChange,
  AttributeHandler
} from "../../src/application/extensions/AttributeHandler.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandInvoker } from "../../src/application/history/CommandInvoker.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";

function createHarness() {
  const session = new EditorSession();
  const document = session.initializeCanvas(100, 100);
  const group = new Group("g1");
  const first = new Rect({
    id: "first",
    x: 0,
    y: 0,
    width: 10,
    height: 10
  });
  const second = new Rect({
    id: "second",
    x: 20,
    y: 0,
    width: 10,
    height: 10
  });
  group.addChild(first);
  group.addChild(second);
  document.addShape(group);
  return {
    session,
    invoker: new CommandInvoker(session),
    first,
    second
  };
}

function attributeHandler(
  apply: (first: Rect, second: Rect) => void
): AttributeHandler {
  return {
    name: "multi-part",
    handles: (shape) => shape.id === "g1",
    prepare(shape): AttributeChange {
      const group = shape as Group;
      const first = group.children[0] as Rect;
      const second = group.children[1] as Rect;
      const firstFill = first.getAttribute("fill");
      const secondFill = second.getAttribute("fill");
      return {
        affectedIds: ["first", "second"],
        message: "multi attribute applied",
        undoMessage: "multi attribute reverted",
        apply(): void {
          apply(first, second);
        },
        revert(): void {
          first.setAttribute("fill", firstFill);
          second.setAttribute("fill", secondFill);
        }
      };
    }
  };
}

describe("AttributeHandler transactions", () => {
  it("uses one undo unit for changes to multiple child parts", () => {
    const { session, invoker, first, second } = createHarness();
    const handlers = new AttributeHandlerRegistry();
    handlers.register(
      attributeHandler((left, right) => {
        left.setAttribute("fill", "red");
        right.setAttribute("fill", "blue");
      })
    );
    const command = new SetAttributeCommandProvider(handlers).create([
      "g1",
      "custom",
      "value"
    ]);

    invoker.execute(command);
    expect(first.getAttribute("fill")).toBe("red");
    expect(second.getAttribute("fill")).toBe("blue");

    invoker.undo();
    expect(first.getAttribute("fill")).toBeUndefined();
    expect(second.getAttribute("fill")).toBeUndefined();

    invoker.redo();
    expect(first.getAttribute("fill")).toBe("red");
    expect(second.getAttribute("fill")).toBe("blue");
    expect(session.document?.shapeCount).toBe(3);
  });

  it("rolls back partial changes when apply throws", () => {
    const { invoker, first, second } = createHarness();
    const handlers = new AttributeHandlerRegistry();
    handlers.register(
      attributeHandler((left) => {
        left.setAttribute("fill", "red");
        throw new Error("second child failed");
      })
    );
    const command = new SetAttributeCommandProvider(handlers).create([
      "g1",
      "custom",
      "value"
    ]);

    expect(() => invoker.execute(command)).toThrow("second child failed");
    expect(first.getAttribute("fill")).toBeUndefined();
    expect(second.getAttribute("fill")).toBeUndefined();
    expect(() => invoker.undo()).toThrow("nothing to undo");
    expect(() => invoker.redo()).toThrow("nothing to redo");
  });
});
