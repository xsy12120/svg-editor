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
import type {
  DirectoryEntry,
  DirectoryReader
} from "../../src/application/ports/DirectoryReader.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { PluginHost } from "../../src/host/PluginHost.js";
import { PluginLoader } from "../../src/host/PluginLoader.js";
import {
  dirPlugin,
  dirPluginManifest
} from "../../src/plugins/command-dir/index.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function directoryReader(
  entries: readonly DirectoryEntry[]
): DirectoryReader {
  return {
    currentDirectory: () => "/current",
    list: () => entries
  };
}

function createHarness(reader: DirectoryReader) {
  const session = new EditorSession();
  const commands = new CommandRegistry<EditorSession>();
  const invoker = new CommandInvoker(session);
  const host = new PluginHost(
    {
      shapes: new ShapeFactory(),
      commands,
      decorators: new TreeDecoratorRegistry(),
      attributes: new AttributeHandlerRegistry()
    },
    { directoryReader: reader }
  );
  return {
    session,
    commands,
    invoker,
    processor: new CommandProcessor(invoker),
    host
  };
}

describe("dir command plugin", () => {
  it("sorts directories, files and special entries deterministically", () => {
    const harness = createHarness(
      directoryReader([
        { name: "z.txt", kind: "file" },
        { name: "zdir", kind: "directory" },
        { name: "link", kind: "symlink" },
        { name: ".hidden", kind: "file" },
        { name: "adir", kind: "directory" },
        { name: "a.txt", kind: "file" }
      ])
    );
    expect(harness.host.activate(dirPlugin, dirPluginManifest)).toEqual({
      success: true
    });

    const result = harness.processor.execute(
      harness.commands.create("dir", [])
    );

    expect(result.message).toBe(
      [
        "[DIR]  adir",
        "[DIR]  zdir",
        "[FILE]  .hidden",
        "[FILE]  a.txt",
        "[FILE]  z.txt",
        "[LINK]  link"
      ].join("\n")
    );
    expect(
      harness.commands
        .listHelpEntries()
        .some((entry) => entry.usage === "dir")
    ).toBe(true);
    expect(harness.session.document).toBeNull();
  });

  it("reports an empty directory", () => {
    const harness = createHarness(directoryReader([]));
    harness.host.activate(dirPlugin, dirPluginManifest);

    expect(
      harness.processor.execute(harness.commands.create("dir", [])).message
    ).toBe("(empty directory)");
  });

  it("reports directory read failures and keeps the CLI available", () => {
    const harness = createHarness({
      currentDirectory: () => "/unreadable",
      list: () => {
        throw new Error("permission denied");
      }
    });
    harness.host.activate(dirPlugin, dirPluginManifest);

    const result = harness.processor.execute(
      harness.commands.create("dir", [])
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "cannot read directory: /unreadable"
    );
  });

  it("does not reset document state or history after a read failure", () => {
    const harness = createHarness({
      currentDirectory: () => "/unreadable",
      list: () => {
        throw new Error("permission denied");
      }
    });
    const document = harness.session.initializeCanvas(100, 100);
    const rect = new Rect({
      id: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10
    });
    document.addShape(rect);
    harness.session.markSaved();
    harness.host.activate(dirPlugin, dirPluginManifest);
    harness.invoker.execute(
      new SetAttributeCommandProvider(
        new AttributeHandlerRegistry()
      ).create(["rect", "fill", "red"])
    );

    const result = harness.processor.execute(
      harness.commands.create("dir", [])
    );

    expect(result.success).toBe(false);
    expect(harness.session.changes.isDirty).toBe(true);
    harness.invoker.undo();
    expect(rect.getAttribute("fill")).toBeUndefined();
  });

  it("does not change dirty state or undo history", () => {
    const harness = createHarness(directoryReader([]));
    const document = harness.session.initializeCanvas(100, 100);
    const rect = new Rect({
      id: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10
    });
    document.addShape(rect);
    harness.session.markSaved();
    harness.host.activate(dirPlugin, dirPluginManifest);
    harness.invoker.execute(
      new SetAttributeCommandProvider(
        new AttributeHandlerRegistry()
      ).create(["rect", "fill", "red"])
    );
    expect(harness.session.changes.isDirty).toBe(true);

    harness.processor.execute(harness.commands.create("dir", []));
    expect(harness.session.changes.isDirty).toBe(true);
    harness.invoker.undo();
    expect(rect.getAttribute("fill")).toBeUndefined();
  });

  it("produces the same output through code and config assembly", async () => {
    const entries = [
      { name: "docs", kind: "directory" as const },
      { name: "demo.svg", kind: "file" as const }
    ];
    const code = createHarness(directoryReader(entries));
    code.host.activate(dirPlugin, dirPluginManifest);
    const codeResult = code.processor.execute(
      code.commands.create("dir", [])
    );

    const config = createHarness(directoryReader(entries));
    const loadResult = await new PluginLoader(config.host).loadConfigFile(
      join(projectRoot, "tests", "fixtures", "configs", "dir.json")
    );
    const configResult = config.processor.execute(
      config.commands.create("dir", [])
    );

    expect(loadResult.diagnostics).toEqual([]);
    expect(configResult.message).toBe(codeResult.message);
  });
});
