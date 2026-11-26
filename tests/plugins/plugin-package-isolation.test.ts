import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const pluginRoot = join(projectRoot, "src", "plugins");

describe("plugin package isolation", () => {
  it("keeps every plugin entry inside its own package", async () => {
    const packageDirectories = (await readdir(pluginRoot, {
      withFileTypes: true
    })).filter((entry) => entry.isDirectory());

    for (const directory of packageDirectories) {
      const packagePath = join(pluginRoot, directory.name, "package.json");
      const packageJson = JSON.parse(
        await readFile(packagePath, "utf8")
      ) as {
        main?: string;
        scripts?: { build?: string };
      };

      expect(packageJson.main).toMatch(/^\.\/dist\//);
      expect(packageJson.scripts?.build).toBeDefined();
      await expect(
        access(join(pluginRoot, directory.name, packageJson.main!))
      ).resolves.toBeUndefined();
    }
  });

  it("imports core contracts only through the public package export", async () => {
    const directories = await readdir(pluginRoot, { withFileTypes: true });
    for (const directory of directories.filter((entry) =>
      entry.isDirectory()
    )) {
      const packageDirectory = join(pluginRoot, directory.name);
      for (const file of await readdir(packageDirectory)) {
        if (!file.endsWith(".ts")) {
          continue;
        }
        const source = await readFile(join(packageDirectory, file), "utf8");
        expect(source).not.toMatch(
          /from\s+["'][^"']*(?:application|infrastructure|bootstrap|host)\//
        );
        if (/from\s+["'][^"']*plugin-api/.test(source)) {
          expect(source).toContain('"svg-editor-pj1/plugin-api"');
        }
      }
    }
  });
});
