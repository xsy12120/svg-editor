import type {
  CommandProvider,
  DirectoryReader,
  EditorCommandContext,
  PluginManifest,
  SvgPlugin
} from "svg-editor-pj1/plugin-api";

import { DirCommand } from "./DirCommand.js";

export const dirPluginManifest: PluginManifest = {
  name: "@svgframe/plugin-command-dir",
  contributes: {
    commands: ["dir"]
  }
};

export const dirPlugin: SvgPlugin = {
  activate(context): void {
    const directories = context.services.directoryReader;
    if (directories === undefined) {
      throw new Error("directory reader service is unavailable");
    }
    context.registerCommand(new DirCommandProvider(directories));
  }
};

export class DirCommandProvider
  implements CommandProvider<EditorCommandContext>
{
  readonly name = "dir";
  readonly usage = "dir";

  constructor(
    private readonly directories: DirectoryReader
  ) {}

  create(args: readonly string[]): DirCommand {
    if (args.length > 0) {
      throw new Error(`usage: ${this.usage}`);
    }
    return new DirCommand(this.directories);
  }
}

export { DirCommand };
export default dirPlugin;
