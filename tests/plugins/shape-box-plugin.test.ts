import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { AddToCommandProvider } from "../../src/application/commands/AddToCommandProvider.js";
import { CreateCommandProvider } from "../../src/application/commands/CreateCommandProvider.js";
import { DeleteCommandProvider } from "../../src/application/commands/DeleteCommandProvider.js";
import { GroupCommandProvider } from "../../src/application/commands/GroupCommandProvider.js";
import { MoveCommandProvider } from "../../src/application/commands/MoveCommandProvider.js";
import { SetAttributeCommandProvider } from "../../src/application/commands/SetAttributeCommandProvider.js";
import { TreeCommandProvider } from "../../src/application/commands/TreeCommandProvider.js";
import { UngroupCommandProvider } from "../../src/application/commands/UngroupCommandProvider.js";
import { ReadDocumentCommand } from "../../src/application/commands/ReadDocumentCommand.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandRegistry } from "../../src/application/extensions/CommandRegistry.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { CommandInvoker } from "../../src/application/history/CommandInvoker.js";
import { TreeSnapshotBuilder } from "../../src/application/queries/TreeSnapshotBuilder.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import type { FileStore } from "../../src/application/ports/FileStore.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { PluginHost } from "../../src/host/PluginHost.js";
import { PluginLoader } from "../../src/host/PluginLoader.js";
import { XmlSvgCodec } from "../../src/infrastructure/svg/XmlSvgCodec.js";
import { CliTreeRenderer } from "../../src/interfaces/cli/CliTreeRenderer.js";
import {
  builtinShapesManifest,
  builtinShapesPlugin
} from "../../src/plugins/builtin-shapes/index.js";
import {
  Box,
  boxPlugin,
  boxPluginManifest
} from "../../src/plugins/shape-box/index.js";
import {
  boxTypeLabelManifest,
  boxTypeLabelPlugin
} from "../../src/plugins/tree-box-label/index.js";
import {
  statsPlugin,
  statsPluginManifest
} from "../../src/plugins/command-stats/index.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

interface Harness {
  readonly session: EditorSession;
  readonly invoker: CommandInvoker<EditorSession>;
  readonly commands: CommandRegistry<EditorSession>;
  readonly shapes: ShapeFactory;
  readonly attributes: AttributeHandlerRegistry;
  readonly decorators: TreeDecoratorRegistry;
  readonly host: PluginHost;
}

function createHarness(withBox = true): Harness {
  const session = new EditorSession();
  session.initializeCanvas(800, 600);
  const commands = new CommandRegistry<EditorSession>();
  const shapes = new ShapeFactory();
  const attributes = new AttributeHandlerRegistry();
  const decorators = new TreeDecoratorRegistry();
  const host = new PluginHost({
    shapes,
    commands,
    attributes,
    decorators
  });
  expect(
    host.activate(builtinShapesPlugin, builtinShapesManifest)
  ).toEqual({ success: true });
  if (withBox) {
    expect(host.activate(boxPlugin, boxPluginManifest)).toEqual({
      success: true
    });
    expect(host.activate(boxTypeLabelPlugin, boxTypeLabelManifest)).toEqual({
      success: true
    });
  }

  const invoker = new CommandInvoker(session);
  commands.register(new CreateCommandProvider(shapes));
  commands.register(new SetAttributeCommandProvider(attributes));
  commands.register(new MoveCommandProvider());
  commands.register(new DeleteCommandProvider());
  commands.register(new GroupCommandProvider());
  commands.register(new AddToCommandProvider());
  commands.register(new UngroupCommandProvider());
  commands.register(
    new TreeCommandProvider(new TreeSnapshotBuilder(decorators))
  );
  return {
    session,
    invoker,
    commands,
    shapes,
    attributes,
    decorators,
    host
  };
}

function execute(
  harness: Harness,
  name: string,
  args: readonly string[]
): ReturnType<CommandInvoker<EditorSession>["execute"]> {
  const command = harness.commands.create(name, args);
  if (command.kind !== "edit") {
    throw new Error(`${name} must be an edit command`);
  }
  return harness.invoker.execute(command);
}

function createBox(
  harness: Harness,
  id = "n1",
  suffix: readonly string[] = []
): void {
  execute(harness, "create", [
    "box",
    id,
    "120",
    "100",
    "160",
    "60",
    "开始",
    ...suffix
  ]);
}

describe("box shape provider", () => {
  it("creates a composite box with derived child ids", () => {
    const harness = createHarness();

    const result = execute(harness, "create", [
      "box",
      "n1",
      "120",
      "100",
      "160",
      "60",
      "开始"
    ]);

    expect(result.message).toBe(
      "box#n1 created (g#n1 + rect#n1-rect + text#n1-label)"
    );
    const box = harness.session.document?.findShape("n1");
    expect(box).toBeInstanceOf(Box);
    expect((box as Box).children.map((child) => child.id)).toEqual([
      "n1-rect",
      "n1-label"
    ]);
    expect((box as Box).body.getAttribute("fill")).toBe("#4a90d9");
    expect((box as Box).label.getAttribute("text")).toBe("开始");
    expect(box?.toDescriptor().typeName).toBe("g");
    expect(box?.semanticTypeName).toBe("box");
  });

  it("sets fill and label through attribute handlers as single undo units", () => {
    const harness = createHarness();
    createBox(harness);
    const box = harness.session.document?.findShape("n1") as Box;

    expect(execute(harness, "set", ["n1", "fill", "#f5a623"]).message).toBe(
      "box#n1 fill propagated to n1-rect"
    );
    expect(box.body.getAttribute("fill")).toBe("#f5a623");

    harness.invoker.undo();
    expect(box.body.getAttribute("fill")).toBe("#4a90d9");
    harness.invoker.redo();
    expect(box.body.getAttribute("fill")).toBe("#f5a623");

    expect(
      execute(harness, "set", ["n1", "label", "处理数据 v2"]).message
    ).toBe('box#n1 label updated: "处理数据 v2"');
    expect(box.label.getAttribute("text")).toBe("处理数据 v2");
    harness.invoker.undo();
    expect(box.label.getAttribute("text")).toBe("开始");
    harness.invoker.redo();
    expect(box.label.getAttribute("text")).toBe("处理数据 v2");
  });

  it("moves, nests and deletes boxes through existing composite commands", () => {
    const harness = createHarness();
    createBox(harness, "n1");
    createBox(harness, "n2");
    const first = harness.session.document?.findShape("n1") as Box;

    execute(harness, "move", ["n1", "0", "100"]);
    expect(first.body.x).toBe(120);
    expect(first.body.y).toBe(200);
    expect(first.label.getAttribute("x")).toBe("140");
    expect(first.label.getAttribute("y")).toBe("235");
    harness.invoker.undo();
    expect(first.body.y).toBe(100);

    createBox(harness, "nested", ["in", "n1"]);
    expect(first.children.at(-1)?.id).toBe("nested");

    execute(harness, "delete", ["n1"]);
    expect(harness.session.document?.findShape("n1")).toBeUndefined();
    harness.invoker.undo();
    expect(harness.session.document?.findShape("n1")).toBeInstanceOf(Box);
  });

  it("groups boxes as subtrees", () => {
    const harness = createHarness();
    createBox(harness, "n1");
    createBox(harness, "n2");

    execute(harness, "group", ["cluster", "n1", "n2"]);

    const cluster = harness.session.document?.findShape("cluster") as Group;
    expect(cluster.children.map((child) => child.id)).toEqual([
      "n1",
      "n2"
    ]);
  });

  it("rejects ungroup and removal of required child parts", () => {
    const harness = createHarness();
    createBox(harness);

    expect(() => execute(harness, "ungroup", ["n1"])).toThrow(
      "cannot ungroup composite shape: n1"
    );
    expect(() => execute(harness, "delete", ["n1-rect"])).toThrow(
      "cannot remove required child: n1-rect"
    );
    expect(harness.session.document?.findShape("n1-rect")?.id).toBe(
      "n1-rect"
    );
  });

  it("rejects moving a required part through addto", () => {
    const harness = createHarness();
    createBox(harness);
    const group = new Group("target");
    harness.session.document?.addShape(group);

    expect(() =>
      execute(harness, "addto", ["target", "n1-rect"])
    ).toThrow("cannot remove required child: n1-rect");
    expect(group.children).toEqual([]);
    expect(harness.session.document?.findShape("n1-rect")?.id).toBe(
      "n1-rect"
    );
  });

  it("rejects subtree id conflicts without leaving partial state", () => {
    const harness = createHarness();
    harness.session.document?.addShape(
      new Rect({
        id: "n1-rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1
      })
    );

    expect(() => createBox(harness, "n1")).toThrow(
      "id already exists: n1-rect"
    );
    expect(harness.session.document?.findShape("n1")).toBeUndefined();
    expect(harness.session.document?.shapeCount).toBe(1);
  });

  it("serializes and restores box with the plugin installed", () => {
    const harness = createHarness();
    createBox(harness);
    const codec = new XmlSvgCodec(harness.shapes);

    const encoded = codec.encode(harness.session.document!);
    expect(encoded).toContain('<g id="n1" data-kind="box">');
    expect(encoded).toContain('<rect id="n1-rect"');
    expect(encoded).toContain('<text id="n1-label"');

    const restored = codec.decode(encoded).document.findShape("n1");
    expect(restored).toBeInstanceOf(Box);
    expect((restored as Box).body.id).toBe("n1-rect");
    expect((restored as Box).label.getAttribute("text")).toBe("开始");
  });

  it("degrades box to a normal group when the plugin is absent", () => {
    const withBox = createHarness();
    createBox(withBox);
    const encoded = new XmlSvgCodec(withBox.shapes).encode(
      withBox.session.document!
    );
    const withoutBox = createHarness(false);

    const restored = new XmlSvgCodec(withoutBox.shapes)
      .decode(encoded)
      .document.findShape("n1");

    expect(restored).toBeInstanceOf(Group);
    expect(restored).not.toBeInstanceOf(Box);
    expect(restored?.toDescriptor().typeName).toBe("g");
  });

  it("rejects a malformed box structure", () => {
    const harness = createHarness();
    const malformed = [
      '<svg width="800" height="600">',
      '  <g id="n1" data-kind="box">',
      '    <rect id="n1-rect" x="10" y="10" width="20" height="20"/>',
      "  </g>",
      "</svg>"
    ].join("\n");

    expect(() => new XmlSvgCodec(harness.shapes).decode(malformed)).toThrow(
      "invalid box: n1"
    );
  });

  it("keeps the active document when reading malformed box data", () => {
    const harness = createHarness();
    const original = harness.session.document!;
    const files: FileStore = {
      read: () => [
        '<svg width="800" height="600">',
        '  <g id="n1" data-kind="box">',
        '    <rect id="n1-rect" x="0" y="0" width="20" height="20"/>',
        "  </g>",
        "</svg>"
      ].join("\n"),
      write: () => {}
    };
    const command = new ReadDocumentCommand(
      "broken.svg",
      files,
      new XmlSvgCodec(harness.shapes)
    );

    expect(() => command.execute(harness.session)).toThrow(
      "invalid SVG: invalid box: n1"
    );
    expect(harness.session.document).toBe(original);
  });

  it("counts box as one container and its required parts as leaves", () => {
    const harness = createHarness();
    createBox(harness);
    expect(
      harness.host.activate(statsPlugin, statsPluginManifest)
    ).toEqual({ success: true });
    const command = harness.commands.create("stats", []);
    if (command.kind === "edit") {
      throw new Error("stats must be a query");
    }
    command.validate(harness.session);

    expect(command.execute(harness.session).message).toBe(
      "rect: 1  text: 1  (total 2, containers 1)"
    );
  });

  it("renders the box type through an independent tree decorator", () => {
    const harness = createHarness();
    createBox(harness);
    const command = harness.commands.create("tree", []);
    if (command.kind === "edit") {
      throw new Error("tree must be a query");
    }
    command.validate(harness.session);
    const result = command.execute(harness.session);
    if (result.view?.kind !== "tree") {
      throw new Error("expected tree view");
    }

    expect(new CliTreeRenderer().render(result.view.snapshot)).toContain(
      "└── g#n1 (box)"
    );
  });

  it("produces the same behavior through code and config assembly", async () => {
    const code = createHarness();
    const config = createHarness(false);
    expect(
      await new PluginLoader(config.host).loadConfigFile(
        join(projectRoot, "tests", "fixtures", "configs", "box.json")
      )
    ).toEqual({ diagnostics: [] });

    const codeCreate = execute(code, "create", [
      "box",
      "n1",
      "120",
      "100",
      "160",
      "60",
      "开始"
    ]);
    const configCreate = execute(config, "create", [
      "box",
      "n1",
      "120",
      "100",
      "160",
      "60",
      "开始"
    ]);

    expect(configCreate.message).toBe(codeCreate.message);
    expect(renderTree(config)).toBe(renderTree(code));
  });
});

function renderTree(harness: Harness): string {
  const command = harness.commands.create("tree", []);
  if (command.kind === "edit") {
    throw new Error("tree must be a query");
  }
  command.validate(harness.session);
  const result = command.execute(harness.session);
  if (result.view?.kind !== "tree") {
    throw new Error("expected tree view");
  }
  return new CliTreeRenderer().render(result.view.snapshot);
}
