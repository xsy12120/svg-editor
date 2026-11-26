import type { EditorSession } from "../application/EditorSession.js";
import type { AttributeHandler } from "../application/extensions/AttributeHandler.js";
import type { CommandProvider } from "../application/extensions/CommandProvider.js";
import type { TreeDecorator } from "../application/extensions/TreeDecorator.js";
import type { ShapeProvider } from "../application/shapes/ShapeProvider.js";
import type {
  PluginActivationResult,
  PluginContributions,
  PluginManifest,
  PluginOptions,
  PluginRegistrationContext,
  SvgPlugin
} from "../plugin-api/Plugin.js";

interface RegistrationTarget<T> {
  register(value: T): void;
  has(name: string): boolean;
}

export interface PluginHostRegistries {
  readonly shapes: RegistrationTarget<ShapeProvider>;
  readonly commands: RegistrationTarget<CommandProvider<EditorSession>>;
  readonly decorators: RegistrationTarget<TreeDecorator>;
  readonly attributes: RegistrationTarget<AttributeHandler>;
}

type Category = keyof PluginContributions;
const categories: readonly Category[] = [
  "shapes",
  "commands",
  "decorators",
  "attributes"
];

export class PluginHost {
  constructor(private readonly registries: PluginHostRegistries) {}

  activate(
    plugin: SvgPlugin,
    manifest: PluginManifest,
    options?: PluginOptions
  ): PluginActivationResult {
    const staged = new StagedPluginContext();
    try {
      plugin.activate(staged, options);
    } catch (error) {
      if (error instanceof DuplicateRegistrationError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: `error: plugin failed to activate: ${manifest.name} (${reasonOf(error)})`
      };
    }

    const declared = normalizeContributions(manifest.contributes);
    const registered = staged.contributions();
    if (!sameContributions(declared, registered)) {
      return {
        success: false,
        error:
          `error: plugin manifest mismatch: ${manifest.name} ` +
          `(${formatContributionDiff(declared, registered)})`
      };
    }

    const duplicate = this.findDuplicate(registered, staged);
    if (duplicate !== undefined) {
      return {
        success: false,
        error: `error: duplicate registration: ${duplicate.category}/${duplicate.name}`
      };
    }

    this.commit(staged);
    return { success: true };
  }

  private findDuplicate(
    contributions: Readonly<Record<Category, readonly string[]>>,
    staged: StagedPluginContext
  ): { readonly category: Category; readonly name: string } | undefined {
    for (const category of categories) {
      const target = this.registries[category];
      for (const name of contributions[category]) {
        if (target.has(name)) {
          return { category, name };
        }
      }
    }
    for (const category of categories) {
      const names = staged.contributions()[category];
      if (new Set(names).size !== names.length) {
        return { category, name: names[0] as string };
      }
    }
    return undefined;
  }

  private commit(staged: StagedPluginContext): void {
    for (const provider of staged.shapes) {
      this.registries.shapes.register(provider);
    }
    for (const provider of staged.commands) {
      this.registries.commands.register(provider);
    }
    for (const decorator of staged.decorators) {
      this.registries.decorators.register(decorator);
    }
    for (const handler of staged.attributes) {
      this.registries.attributes.register(handler);
    }
  }
}

class StagedPluginContext implements PluginRegistrationContext {
  readonly shapes: ShapeProvider[] = [];
  readonly commands: CommandProvider<EditorSession>[] = [];
  readonly decorators: TreeDecorator[] = [];
  readonly attributes: AttributeHandler[] = [];

  registerShape(provider: ShapeProvider): void {
    this.add("shapes", provider.typeName, this.shapes, provider);
  }

  registerCommand(provider: CommandProvider<EditorSession>): void {
    this.add("commands", provider.name, this.commands, provider);
  }

  registerTreeDecorator(decorator: TreeDecorator): void {
    this.add(
      "decorators",
      decorator.name,
      this.decorators,
      decorator
    );
  }

  registerAttributeHandler(handler: AttributeHandler): void {
    this.add(
      "attributes",
      handler.name,
      this.attributes,
      handler
    );
  }

  contributions(): Record<Category, readonly string[]> {
    return {
      shapes: this.shapes.map((provider) => provider.typeName),
      commands: this.commands.map((provider) => provider.name),
      decorators: this.decorators.map((decorator) => decorator.name),
      attributes: this.attributes.map((handler) => handler.name)
    };
  }

  private add<T>(
    category: Category,
    name: string,
    target: T[],
    value: T
  ): void {
    if (
      this.contributions()[category].includes(name)
    ) {
      throw new DuplicateRegistrationError(
        `error: duplicate registration: ${category}/${name}`
      );
    }
    target.push(value);
  }
}

class DuplicateRegistrationError extends Error {}

function normalizeContributions(
  contributions: PluginContributions
): Record<Category, readonly string[]> {
  return {
    shapes: normalizeNames(contributions.shapes),
    commands: normalizeNames(contributions.commands),
    decorators: normalizeNames(contributions.decorators),
    attributes: normalizeNames(contributions.attributes)
  };
}

function normalizeNames(
  names: readonly string[] | undefined
): readonly string[] {
  return [...new Set(names ?? [])].sort(compareNames);
}

function sameContributions(
  left: Readonly<Record<Category, readonly string[]>>,
  right: Readonly<Record<Category, readonly string[]>>
): boolean {
  return categories.every(
    (category) =>
      left[category].length === right[category].length &&
      left[category].every(
        (name, index) => name === right[category][index]
      )
  );
}

function formatContributionDiff(
  declared: Readonly<Record<Category, readonly string[]>>,
  registered: Readonly<Record<Category, readonly string[]>>
): string {
  const format = (
    values: Readonly<Record<Category, readonly string[]>>
  ): string =>
    categories
      .filter((category) => values[category].length > 0)
      .map((category) => `${category}=[${values[category].join(",")}]`)
      .join("; ");
  return `declared: ${format(declared)}; registered: ${format(registered)}`;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
