import type { CommandResult } from "../commands/CommandResult.js";
import type { PreparedEdit } from "../commands/PreparedEdit.js";
import type { UndoableCommand } from "../commands/UndoableCommand.js";
import { CommandRejectedError } from "../../shared/errors/CommandRejectedError.js";

export class CommandInvoker<TContext> {
  private readonly undoStack: PreparedEdit<TContext>[] = [];
  private readonly redoStack: PreparedEdit<TContext>[] = [];
  private historyBlocked = false;

  constructor(readonly context: TContext) {}

  execute(command: UndoableCommand<TContext>): CommandResult {
    let edit: PreparedEdit<TContext>;
    try {
      edit = command.prepare(this.context);
    } catch (error) {
      throw CommandRejectedError.from(error);
    }
    let result: CommandResult;
    try {
      result = edit.apply(this.context);
    } catch (error) {
      const rollbackError = this.rollback(edit);
      if (rollbackError !== undefined) {
        throw new CommandRejectedError(
          `command failed: ${reasonOf(error)}; rollback failed: ${reasonOf(rollbackError)}`
        );
      }
      throw CommandRejectedError.from(error);
    }
    if (!result.success) {
      const rollbackError = this.rollback(edit);
      if (rollbackError !== undefined) {
        throw new CommandRejectedError(
          `command failed: ${result.message}; rollback failed: ${reasonOf(rollbackError)}`
        );
      }
      return result;
    }

    this.historyBlocked = false;
    this.undoStack.push(edit);
    this.redoStack.length = 0;
    return result;
  }

  undo(): CommandResult {
    this.ensureHistoryAvailable("undo");

    const edit = this.undoStack.at(-1);
    if (edit === undefined) {
      throw new CommandRejectedError("nothing to undo");
    }

    const result = edit.revert(this.context);
    if (!result.success) {
      return result;
    }

    this.undoStack.pop();
    this.redoStack.push(edit);
    return result;
  }

  redo(): CommandResult {
    this.ensureHistoryAvailable("redo");

    const edit = this.redoStack.at(-1);
    if (edit === undefined) {
      throw new CommandRejectedError("nothing to redo");
    }

    let result: CommandResult;
    try {
      result = edit.apply(this.context);
    } catch (error) {
      const rollbackError = this.rollback(edit);
      if (rollbackError !== undefined) {
        throw new CommandRejectedError(
          `command failed: ${reasonOf(error)}; rollback failed: ${reasonOf(rollbackError)}`
        );
      }
      throw CommandRejectedError.from(error);
    }
    if (!result.success) {
      const rollbackError = this.rollback(edit);
      if (rollbackError !== undefined) {
        throw new CommandRejectedError(
          `command failed: ${result.message}; rollback failed: ${reasonOf(rollbackError)}`
        );
      }
      return result;
    }

    this.redoStack.pop();
    this.undoStack.push(edit);
    return result;
  }

  resetAfterDocumentCommand(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.historyBlocked = true;
  }

  private ensureHistoryAvailable(operation: "undo" | "redo"): void {
    if (this.historyBlocked) {
      throw new CommandRejectedError(
        `${operation} not allowed after io command`
      );
    }
  }

  private rollback(edit: PreparedEdit<TContext>): unknown | undefined {
    try {
      edit.rollback?.(this.context);
      return undefined;
    } catch (error) {
      return error;
    }
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
