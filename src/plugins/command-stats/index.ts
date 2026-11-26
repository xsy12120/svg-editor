import type {
  CommandProvider,
  EditorCommandContext,
  PluginManifest,
  SvgPlugin
} from "svg-editor-pj1/plugin-api";

import { StatsCommand } from "./StatsCommand.js";

export const statsPluginManifest: PluginManifest = {
  name: "@svgframe/plugin-command-stats",
  contributes: {
    commands: ["stats"]
  }
};

export const statsPlugin: SvgPlugin = {
  activate(context): void {
    context.registerCommand(new StatsCommandProvider());
  }
};

export class StatsCommandProvider
  implements CommandProvider<EditorCommandContext>
{
  readonly name = "stats";
  readonly usage = "stats";

  create(args: readonly string[]): StatsCommand {
    if (args.length > 0) {
      throw new Error(`usage: ${this.usage}`);
    }
    return new StatsCommand();
  }
}

export { StatsCommand };
export default statsPlugin;
