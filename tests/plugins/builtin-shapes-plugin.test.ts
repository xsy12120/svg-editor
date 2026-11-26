import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandRegistry } from "../../src/application/extensions/CommandRegistry.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { PluginHost } from "../../src/host/PluginHost.js";
import {
  builtinShapesManifest,
  builtinShapesPlugin
} from "../../src/plugins/builtin-shapes/index.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("builtin shapes plugin package", () => {
  it("declares the same contributions as its exported manifest", async () => {
    const packageJson = JSON.parse(
      await readFile(
        join(projectRoot, "src", "plugins", "builtin-shapes", "package.json"),
        "utf8"
      )
    ) as {
      contributes?: {
        shapes?: readonly string[];
      };
    };

    expect(packageJson.contributes?.shapes).toEqual(
      builtinShapesManifest.contributes.shapes
    );
  });

  it("registers all built-in shapes through the plugin host", () => {
    const shapes = new ShapeFactory();
    const host = new PluginHost({
      shapes,
      commands: new CommandRegistry<EditorSession>(),
      decorators: new TreeDecoratorRegistry(),
      attributes: new AttributeHandlerRegistry()
    });

    expect(host.activate(builtinShapesPlugin, builtinShapesManifest)).toEqual({
      success: true
    });

    for (const typeName of [
      "circle",
      "ellipse",
      "g",
      "line",
      "rect",
      "text"
    ]) {
      expect(shapes.has(typeName)).toBe(true);
    }
  });

  it("imports only public APIs and local plugin modules", async () => {
    const pluginDirectory = join(
      projectRoot,
      "src",
      "plugins",
      "builtin-shapes"
    );
    const entries = await readdir(pluginDirectory);

    for (const entry of entries.filter((name) => name.endsWith(".ts"))) {
      const source = await readFile(join(pluginDirectory, entry), "utf8");
      expect(source).not.toMatch(
        /from\s+["'][^"']*(?:application|infrastructure|bootstrap|host)\//
      );
    }
  });
});
