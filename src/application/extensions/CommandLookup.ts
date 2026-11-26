import type { ExecutableCommand } from "../commands/ExecutableCommand.js";

export interface CommandHelpEntry {
  readonly name: string;
  readonly usage: string;
}

export interface CommandLookup<TContext> {
  create(name: string, args: readonly string[]): ExecutableCommand<TContext>;
  listHelpEntries(): readonly CommandHelpEntry[];
}
