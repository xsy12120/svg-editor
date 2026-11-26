import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function collectImports(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const imports: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      imports.push(...(await collectImports(path)));
      continue;
    }
    if (!entry.name.endsWith(".ts")) {
      continue;
    }

    const source = await readFile(path, "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier !== undefined) {
        imports.push(`${relative(projectRoot, path)} -> ${specifier}`);
      }
    }
  }
  return imports;
}

describe("architecture dependency rules", () => {
  it("keeps infrastructure behind application ports", async () => {
    const imports = await collectImports(join(projectRoot, "src", "infrastructure"));
    const applicationViolations = imports.filter((entry) => {
      const specifier = entry.split(" -> ")[1] ?? "";
      return (
        specifier.includes("/application/") &&
        !specifier.includes("/application/ports/")
      );
    });

    expect(applicationViolations).toEqual([]);
  });

  it("prevents domain and application reverse dependencies", async () => {
    const domainImports = await collectImports(join(projectRoot, "src", "domain"));
    const applicationImports = await collectImports(
      join(projectRoot, "src", "application")
    );

    expect(
      domainImports.filter(
        (entry) =>
          entry.includes("/application/") ||
          entry.includes("/infrastructure/") ||
          entry.includes("/interfaces/") ||
          entry.includes(" -> node:")
      )
    ).toEqual([]);
    expect(
      applicationImports.filter(
        (entry) =>
          entry.includes("/infrastructure/") ||
          entry.includes("/interfaces/")
      )
    ).toEqual([]);
  });

  it("keeps command code behind factory and registry interfaces", async () => {
    const commandImports = await collectImports(
      join(projectRoot, "src", "application", "commands")
    );
    const cliImports = await collectImports(
      join(projectRoot, "src", "interfaces", "cli")
    );

    expect(
      commandImports.filter((entry) =>
        entry.includes("/application/shapes/ShapeFactory.js")
      )
    ).toEqual([]);
    expect(
      cliImports.filter((entry) =>
        entry.includes("/application/extensions/CommandRegistry.js")
      )
    ).toEqual([]);
  });

  it("does not expose the concrete writable session through plugin commands", async () => {
    const source = await readFile(
      join(projectRoot, "src", "plugin-api", "Plugin.ts"),
      "utf8"
    );

    expect(source).not.toContain("EditorSession");
    expect(source).toContain("EditorCommandContext");
  });

  it("does not expose a writable document through tree decorators", async () => {
    const source = await readFile(
      join(
        projectRoot,
        "src",
        "application",
        "extensions",
        "TreeDecorator.ts"
      ),
      "utf8"
    );

    expect(source).not.toMatch(
      /import type \{ Document \} from "\.\.\/\.\.\/domain\/model/
    );
    expect(source).toContain("EditorDocumentContext");
  });
});
