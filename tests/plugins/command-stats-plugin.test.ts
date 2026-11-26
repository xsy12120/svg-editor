import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { SetAttributeCommandProvider } from "../../src/application/commands/SetAttributeCommandProvider.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandRegistry } from "../../src/application/extensions/CommandRegistry.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { CommandInvoker } from "../../src/application/history/CommandInvoker.js";
import { CommandProcessor } from "../../src/application/history/CommandProcessor.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { Circle } from "../../src/domain/shapes/Circle.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Line } from "../../src/domain/shapes/Line.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Text } from "../../src/domain/shapes/Text.js";
import { PluginHost } from "../../src/host/PluginHost.js";
import { PluginLoader } from "../../src/host/PluginLoader.js";
import {
  statsPlugin,
  statsPluginManifest
} from "../../src/plugins/command-stats/index.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function createDocumentSession(): EditorSession {
  const session = new EditorSession();
  const document = session.initializeCanvas(400, 200);
  const first = new Group("first");
  first.addChild(
    new Rect({ id: "r1", x: 0, y: 0, width: 10, height: 10 })
  );
  first.addChild(new Circle({ id: "c1", cx: 20, cy: 20, r: 5 }));
  const second = new Group("second");
  second.addChild(
    new Rect({ id: "r2", x: 30, y: 0, width: 10, height: 10 })
  );
  second.addChild(new Text({ id: "t1", x: 10, y: 50, content: "one" }));
  second.addChild(new Text({ id: "t2", x: 10, y: 70, content: "two" }));
  document.addShape(first);
  document.addShape(second);
  document.addShape(
    new Line({ id: "line", x1: 0, y1: 0, x2: 10, y2: 10 })
  );
  return session;
}

function createHarness() {
  const session = new EditorSession();
  const commands = new CommandRegistry<EditorSession>();
  const host = new PluginHost({
    shapes: new ShapeFactory(),
    commands,
    decorators: new TreeDecoratorRegistry(),
    attributes: new AttributeHandlerRegistry()
  });
  const invoker = new CommandInvoker(session);
  const processor = new CommandProcessor(invoker);
  return { session, commands, host, invoker, processor };
}

describe("stats command plugin", () => {
  it("counts leaves in first-occurrence DFS order", () => {
    const { session, commands, host, processor } = createHarness();
    const target = createDocumentSession();
    session.replaceDocument(target.document!, "stats-test.svg");
    expect(host.activate(statsPlugin, statsPluginManifest)).toEqual({
      success: true
    });

    const result = processor.execute(commands.create("stats", []));

    expect(result.message).toBe(
      "rect: 2  circle: 1  text: 2  line: 1  (total 6, containers 2)"
    );
  });

  it("counts containers without including the root document", () => {
    const { session, commands, host, processor } = createHarness();
    session.initializeCanvas(100, 100);
    expect(host.activate(statsPlugin, statsPluginManifest)).toEqual({
      success: true
    });

    const result = processor.execute(commands.create("stats", []));

    expect(result.message).toBe("(total 0, containers 0)");
  });

  it("requires an initialized document", () => {
    const { commands, host, processor } = createHarness();
    expect(host.activate(statsPlugin, statsPluginManifest)).toEqual({
      success: true
    });

    expect(() => processor.execute(commands.create("stats", []))).toThrow(
      "no document. use 'init' or 'read' first"
    );
  });

  it("is listed in help and remains outside undo history", () => {
    const { session, commands, host, invoker, processor } = createHarness();
    const document = session.initializeCanvas(100, 100);
    const rect = new Rect({
      id: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10
    });
    document.addShape(rect);
    session.markSaved();
    expect(host.activate(statsPlugin, statsPluginManifest)).toEqual({
      success: true
    });
    invoker.execute(
      new SetAttributeCommandProvider().create(["rect", "fill", "red"])
    );

    processor.execute(commands.create("stats", []));
    expect(
      commands.listHelpEntries().some((entry) => entry.name === "stats")
    ).toBe(true);
    invoker.undo();
    expect(rect.getAttribute("fill")).toBeUndefined();
  });

  it("produces the same result through config assembly", async () => {
    const session = createDocumentSession();
    const code = createHarness();
    code.session.replaceDocument(session.document!, "stats-test.svg");
    code.host.activate(statsPlugin, statsPluginManifest);
    const codeResult = code.processor.execute(
      code.commands.create("stats", [])
    );

    const config = createHarness();
    config.session.replaceDocument(session.document!, "stats-test.svg");
    const loader = new PluginLoader(config.host);
    const loadResult = await loader.loadConfigFile(
      join(projectRoot, "tests", "fixtures", "configs", "stats.json")
    );
    const configResult = config.processor.execute(
      config.commands.create("stats", [])
    );

    expect(loadResult.diagnostics).toEqual([]);
    expect(configResult.message).toBe(codeResult.message);
  });
});
