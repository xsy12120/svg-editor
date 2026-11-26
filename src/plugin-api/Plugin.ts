import type { EditorCommandContext } from "../application/context/EditorCommandContext.js";
import type { AttributeHandler } from "../application/extensions/AttributeHandler.js";
import type { CommandProvider } from "../application/extensions/CommandProvider.js";
import type { TreeDecorator } from "../application/extensions/TreeDecorator.js";
import type { DirectoryReader } from "../application/ports/DirectoryReader.js";
import type { ShapeProvider } from "../application/shapes/ShapeProvider.js";

export type PluginOptions = Readonly<Record<string, unknown>>;

export interface PluginContributions {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly decorators?: readonly string[];
  readonly attributes?: readonly string[];
}

export interface PluginManifest {
  readonly name: string;
  readonly contributes: PluginContributions;
}

export interface PluginServices {
  readonly directoryReader?: DirectoryReader;
}

export interface PluginRegistrationContext {
  readonly services: PluginServices;
  registerShape(provider: ShapeProvider): void;
  registerCommand(provider: CommandProvider<EditorCommandContext>): void;
  registerTreeDecorator(decorator: TreeDecorator): void;
  registerAttributeHandler(handler: AttributeHandler): void;
}

export interface SvgPlugin {
  activate(
    context: PluginRegistrationContext,
    options?: PluginOptions
  ): void;
}

export type PluginActivationResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };
