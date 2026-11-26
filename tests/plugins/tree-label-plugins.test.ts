import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { CreateCommandProvider } from "../../src/application/commands/CreateCommandProvider.js";
import { SetAttributeCommandProvider } from "../../src/application/commands/SetAttributeCommandProvider.js";
import { TreeCommandProvider } from "../../src/application/commands/TreeCommandProvider.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandRegistry } from "../../src/application/extensions/CommandRegistry.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { CommandInvoker } from "../../src/application/history/CommandInvoker.js";
import { TreeSnapshotBuilder } from "../../src/application/queries/TreeSnapshotBuilder.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { PluginHost } from "../../src/host/PluginHost.js";
import { PluginLoader } from "../../src/host/PluginLoader.js";
import { CliTreeRenderer } from "../../src/interfaces/cli/CliTreeRenderer.js";
import {
  builtinShapesManifest,
  builtinShapesPlugin
} from "../../src/plugins/builtin-shapes/index.js";
import {
  boxPlugin,
  boxPluginManifest
} from "../../src/plugins/shape-box/index.js";
import {
  boxTypeLabelManifest,
  boxTypeLabelPlugin
} from "../../src/plugins/tree-box-label/index.js";
import {
  modifiedStarManifest,
  modifiedStarPlugin
} from "../../src/plugins/tree-star/index.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

interface Harness {
  readonly session: EditorSession;
  readonly invoker: CommandInvoker<EditorSession>;
  readonly commands: CommandRegistry<EditorSession>;
  readonly decorators: TreeDecoratorRegistry;
  readonly host: PluginHost;
}

function createHarness(
  withLabels = true,
  withBox = true
): Harness {
  const session = new EditorSession();
  session.initializeCanvas(800, 600);
  const commands = new CommandRegistry<EditorSession>();
  const shapes = new ShapeFactory();
  const attributes = new AttributeHandlerRegistry();
  const decorators = new TreeDecoratorRegistry();
  const host = new PluginHost({
    commands,
    shapes,
    attributes,
    decorators
  });
  host.activate(builtinShapesPlugin, builtinShapesManifest);
  if (withBox) {
    host.activate(boxPlugin, boxPluginManifest);
  }
  if (withLabels) {
    host.activate(boxTypeLabelPlugin, boxTypeLabelManifest);
    host.activate(modifiedStarPlugin, modifiedStarManifest);
  }

  const invoker = new CommandInvoker(session);
  commands.register(new CreateCommandProvider(shapes));
  commands.register(new SetAttributeCommandProvider(attributes));
  commands.register(
    new TreeCommandProvider(new TreeSnapshotBuilder(decorators))
  );
  return { session, invoker, commands, decorators, host };
}

function execute(
  harness: Harness,
  name: string,
  args: readonly string[]
) {
  const command = harness.commands.create(name, args);
  if (command.kind !== "edit") {
    throw new Error(`${name} must be an edit command`);
  }
  return harness.invoker.execute(command);
}

function createBox(harness: Harness): void {
  execute(harness, "create", [
    "box",
    "n1",
    "120",
    "100",
    "160",
    "60",
    "开始"
  ]);
}

function renderTree(harness: Harness, rootId?: string): string {
  const command = harness.commands.create(
    "tree",
    rootId === undefined ? [] : [rootId]
  );
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

describe("tree label plugins", () => {
  it("combines (box) and * labels in deterministic priority order", () => {
    const harness = createHarness();
    createBox(harness);

    const tree = renderTree(harness);

    expect(tree).toContain("svg (800x600) *");
    expect(tree).toContain("└── g#n1 (box) *");
    expect(tree).toContain("rect#n1-rect");
    expect(tree).toContain("text#n1-label");
  });

  it("follows edit, save, edit and undo back to the saved state", () => {
    const harness = createHarness();
    createBox(harness);
    harness.session.markSaved();
    expect(renderTree(harness)).not.toContain("*");

    execute(harness, "set", ["n1", "fill", "#f5a623"]);
    expect(renderTree(harness)).toContain("g#n1 (box) *");
    expect(renderTree(harness)).toContain("rect#n1-rect");

    harness.session.markSaved();
    expect(renderTree(harness)).not.toContain("*");

    execute(harness, "set", ["n1", "label", "处理数据 v2"]);
    expect(renderTree(harness)).toContain('text#n1-label');
    expect(renderTree(harness)).toContain("g#n1 (box) *");

    harness.invoker.undo();
    expect(renderTree(harness)).not.toContain("*");
  });

  it("marks a newly created node and its ancestors immediately", () => {
    const harness = createHarness();
    createBox(harness);
    harness.session.markSaved();

    execute(harness, "create", [
      "box",
      "nested",
      "20",
      "20",
      "40",
      "20",
      "内层",
      "in",
      "n1"
    ]);
    const tree = renderTree(harness, "n1");

    expect(tree).toContain("g#n1 (box) *");
    expect(tree).toContain("g#nested (box) *");
  });

  it("keeps modified-star independent from the box label plugin", () => {
    const harness = createHarness(false);
    harness.host.activate(modifiedStarPlugin, modifiedStarManifest);
    createBox(harness);

    const tree = renderTree(harness);

    expect(tree).toContain("g#n1 *");
    expect(tree).not.toContain("(box)");
  });

  it("is independent of class type and works for ordinary shapes", () => {
    const harness = createHarness(false);
    harness.host.activate(modifiedStarPlugin, modifiedStarManifest);
    execute(harness, "create", ["g", "plain"]);
    harness.session.markSaved();
    execute(harness, "create", [
      "rect",
      "rect",
      "0",
      "0",
      "10",
      "10"
    ]);

    expect(renderTree(harness)).not.toContain("g#plain *");
    expect(renderTree(harness)).toContain("rect#rect");
  });

  it("produces identical labels through code and config assembly", async () => {
    const code = createHarness();
    createBox(code);
    const codeTree = renderTree(code);

    const config = createHarness(false, false);
    const result = await new PluginLoader(config.host).loadConfigFile(
      join(projectRoot, "tests", "fixtures", "configs", "tree-labels.json")
    );
    createBox(config);

    expect(result.diagnostics).toEqual([]);
    expect(renderTree(config)).toBe(codeTree);
  });
});
