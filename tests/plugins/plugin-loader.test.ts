import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandRegistry } from "../../src/application/extensions/CommandRegistry.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { PluginHost } from "../../src/host/PluginHost.js";
import { PluginLoader } from "../../src/host/PluginLoader.js";
import type { SvgPlugin } from "../../src/plugin-api/Plugin.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixtureDirectory = join(projectRoot, "tests", "fixtures");

function createHarness() {
  const commands = new CommandRegistry<EditorSession>();
  const host = new PluginHost({
    commands,
    shapes: new ShapeFactory(),
    decorators: new TreeDecoratorRegistry(),
    attributes: new AttributeHandlerRegistry()
  });
  return { loader: new PluginLoader(host), host, commands };
}

describe("PluginLoader", () => {
  it("loads valid plugins in order and continues after each failure", async () => {
    const { loader, commands } = createHarness();

    const result = await loader.loadConfigFile(
      join(fixtureDirectory, "configs", "failures.json")
    );

    expect(result.errors).toEqual([
      "error: plugin has no default export: ../plugins/no-default/index.js",
      "error: plugin not found: ../plugins/missing/index.js",
      "error: plugin manifest mismatch: @fixture/mismatch " +
        "(declared: commands=[declared-command]; " +
        "registered: commands=[actual-command])",
      "error: plugin failed to activate: @fixture/throws " +
        "(fixture activation failure)"
    ]);
    expect(commands.listHelpEntries().map((entry) => entry.name)).toEqual([
      "fixture-good",
      "fixture-terminal"
    ]);
  });

  it("rejects duplicate registrations and continues with later plugins", async () => {
    const { loader, commands } = createHarness();

    const result = await loader.loadConfigFile(
      join(fixtureDirectory, "configs", "duplicate.json")
    );

    expect(result.errors).toEqual([
      "error: duplicate registration: commands/fixture-good"
    ]);
    expect(commands.listHelpEntries().map((entry) => entry.name)).toEqual([
      "fixture-good",
      "fixture-terminal"
    ]);
  });

  it("skips disabled entries without resolving their modules", async () => {
    const { loader, commands } = createHarness();

    const result = await loader.loadConfigFile(
      join(fixtureDirectory, "configs", "disabled.json")
    );

    expect(result.errors).toEqual([]);
    expect(commands.listHelpEntries().map((entry) => entry.name)).toEqual([
      "fixture-terminal"
    ]);
  });

  it("loads a local plugin by package directory", async () => {
    const { loader, commands } = createHarness();

    const result = await loader.loadConfigFile(
      join(fixtureDirectory, "configs", "package-directory.json")
    );

    expect(result.errors).toEqual([]);
    expect(commands.has("fixture-good")).toBe(true);
  });

  it("falls back to built-ins for invalid configuration", async () => {
    const { loader } = createHarness();

    const result = await loader.loadConfigFile(
      join(fixtureDirectory, "configs", "invalid.json")
    );

    expect(result.errors).toEqual(["error: invalid plugin config"]);
  });

  it("reports module evaluation failures as plugin activation failures", async () => {
    const { loader } = createHarness();

    const result = await loader.loadConfigFile(
      join(fixtureDirectory, "configs", "evaluation-error.json")
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(
      "error: plugin failed to activate: @fixture/evaluation-error"
    );
    expect(result.errors[0]).not.toContain("plugin not found");
  });

  it("produces the same behavior through code and config assembly", async () => {
    const code = createHarness();
    const loaded = await import(
      pathToFileURL(
        join(fixtureDirectory, "plugins", "good", "index.js")
      ).href
    );
    const plugin = loaded.default as SvgPlugin;
    expect(
      code.host.activate(
        plugin,
        {
          name: "@fixture/good",
          contributes: { commands: ["fixture-good"] }
        },
        { suffix: "configured" }
      )
    ).toEqual({ success: true });

    const configured = createHarness();
    const loadResult = await configured.loader.loadConfigFile(
      join(fixtureDirectory, "configs", "good.json")
    );
    expect(loadResult.errors).toEqual([]);

    const session = new EditorSession();
    const codeCommand = code.commands.create("fixture-good", ["value"]);
    const configCommand = configured.commands.create(
      "fixture-good",
      ["value"]
    );
    if (codeCommand.kind === "edit" || configCommand.kind === "edit") {
      throw new Error("fixture commands must be non-editable");
    }
    codeCommand.validate(session);
    configCommand.validate(session);

    expect(codeCommand.execute(session).message).toBe(
      configCommand.execute(session).message
    );
  });
});
