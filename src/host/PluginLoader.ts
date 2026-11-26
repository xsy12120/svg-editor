import { access, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
  PluginContributions,
  PluginManifest,
  PluginOptions,
  SvgPlugin
} from "../plugin-api/Plugin.js";
import type { PluginHost } from "./PluginHost.js";

export interface PluginLoadResult {
  readonly errors: readonly string[];
}

interface PluginConfigEntry {
  readonly module: string;
  readonly enabled?: boolean;
  readonly options?: PluginOptions;
}

interface ResolvedPluginModule {
  readonly moduleUrl: string;
  readonly manifestPath: string | null;
}

export class PluginLoader {
  constructor(private readonly host: PluginHost) {}

  async loadConfigFile(configPath: string): Promise<PluginLoadResult> {
    const entries = await this.readConfig(configPath);
    if (entries === null) {
      return { errors: ["error: invalid plugin config"] };
    }

    const errors: string[] = [];
    for (const entry of entries) {
      if (entry.enabled === false) {
        continue;
      }

      const resolved = await this.resolveModule(entry.module, configPath);
      if (resolved === null) {
        errors.push(`error: plugin not found: ${entry.module}`);
        continue;
      }

      const manifest = await this.readManifest(resolved.manifestPath);
      if (manifest === null) {
        errors.push(
          `error: plugin failed to activate: ${entry.module} ` +
            "(invalid plugin package)"
        );
        continue;
      }

      let imported: Record<string, unknown>;
      try {
        imported = (await import(
          resolved.moduleUrl
        )) as Record<string, unknown>;
      } catch (error) {
        errors.push(
          `error: plugin failed to activate: ${manifest.name} ` +
            `(${reasonOf(error)})`
        );
        continue;
      }

      if (!Object.hasOwn(imported, "default")) {
        errors.push(
          `error: plugin has no default export: ${entry.module}`
        );
        continue;
      }

      const plugin = imported["default"];
      if (!isSvgPlugin(plugin)) {
        errors.push(
          `error: plugin failed to activate: ${manifest.name} ` +
            "(default export must implement activate)"
        );
        continue;
      }

      const result = this.host.activate(
        plugin,
        manifest,
        entry.options
      );
      if (!result.success) {
        errors.push(result.error);
      }
    }

    return { errors };
  }

  private async readConfig(
    configPath: string
  ): Promise<readonly PluginConfigEntry[] | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(configPath, "utf8"));
    } catch {
      return null;
    }
    if (!isRecord(parsed) || !Array.isArray(parsed["plugins"])) {
      return null;
    }

    const entries: PluginConfigEntry[] = [];
    for (const value of parsed["plugins"]) {
      const entry = parseConfigEntry(value);
      if (entry === null) {
        return null;
      }
      entries.push(entry);
    }
    return entries;
  }

  private async resolveModule(
    moduleSpecifier: string,
    configPath: string
  ): Promise<ResolvedPluginModule | null> {
    try {
      if (
        moduleSpecifier.startsWith(".") ||
        isAbsolute(moduleSpecifier)
      ) {
        const local = await this.resolveLocalEntry(
          resolve(dirname(configPath), moduleSpecifier)
        );
        await access(local.entryPath);
        return {
          moduleUrl: pathToFileURL(local.entryPath).href,
          manifestPath:
            local.manifestPath ??
            (await this.findManifestPath(local.entryPath))
        };
      }

      const moduleUrl = import.meta.resolve(
        moduleSpecifier,
        pathToFileURL(configPath).href
      );
      const entryPath = fileURLToPath(moduleUrl);
      await access(entryPath);
      return {
        moduleUrl,
        manifestPath: await this.findManifestPath(entryPath)
      };
    } catch {
      return null;
    }
  }

  private async resolveLocalEntry(pathname: string): Promise<{
    readonly entryPath: string;
    readonly manifestPath: string | null;
  }> {
    const entry = await stat(pathname);
    if (!entry.isDirectory()) {
      return { entryPath: pathname, manifestPath: null };
    }

    const packagePath = join(pathname, "package.json");
    const packageJson = JSON.parse(
      await readFile(packagePath, "utf8")
    ) as unknown;
    if (!isRecord(packageJson)) {
      throw new Error("invalid plugin package");
    }
    const main = packageJson["main"];
    return {
      entryPath: resolve(
        pathname,
        typeof main === "string" ? main : "./index.js"
      ),
      manifestPath: packagePath
    };
  }

  private async readManifest(
    packagePath: string | null
  ): Promise<PluginManifest | null> {
    if (packagePath === null) {
      return null;
    }
    try {
      return parseManifest(
        JSON.parse(await readFile(packagePath, "utf8")) as unknown
      );
    } catch {
      return null;
    }
  }

  private async findManifestPath(
    entryPath: string
  ): Promise<string | null> {
    let directory = dirname(entryPath);
    while (true) {
      const packagePath = join(directory, "package.json");
      try {
        await access(packagePath);
        return packagePath;
      } catch {
        const parent = dirname(directory);
        if (parent === directory) {
          return null;
        }
        directory = parent;
      }
    }
  }
}

function parseConfigEntry(value: unknown): PluginConfigEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const moduleName = value["module"];
  const enabled = value["enabled"];
  const options = value["options"];
  if (typeof moduleName !== "string" || moduleName.length === 0) {
    return null;
  }
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return null;
  }
  if (
    options !== undefined &&
    (!isRecord(options) || Array.isArray(options))
  ) {
    return null;
  }

  return {
    module: moduleName,
    ...(enabled === undefined ? {} : { enabled }),
    ...(options === undefined ? {} : { options })
  };
}

function parseManifest(value: unknown): PluginManifest | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = value["name"];
  if (typeof name !== "string" || name.length === 0) {
    return null;
  }
  const rawContributions = value["contributes"] ?? {};
  if (!isRecord(rawContributions)) {
    return null;
  }
  const contributions = parseContributions(rawContributions);
  return contributions === null ? null : { name, contributes: contributions };
}

function parseContributions(
  value: Record<string, unknown>
): PluginContributions | null {
  const shapes = stringArray(value["shapes"]);
  const commands = stringArray(value["commands"]);
  const decorators = stringArray(value["decorators"]);
  const attributes = stringArray(value["attributes"]);
  if (
    shapes === null ||
    commands === null ||
    decorators === null ||
    attributes === null
  ) {
    return null;
  }

  return {
    ...(shapes === undefined ? {} : { shapes }),
    ...(commands === undefined ? {} : { commands }),
    ...(decorators === undefined ? {} : { decorators }),
    ...(attributes === undefined ? {} : { attributes })
  };
}

function stringArray(value: unknown): readonly string[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    return null;
  }
  return value as string[];
}

function isSvgPlugin(value: unknown): value is SvgPlugin {
  return (
    isRecord(value) &&
    typeof value["activate"] === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
