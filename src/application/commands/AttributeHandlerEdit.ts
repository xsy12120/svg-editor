import type { EditorSession } from "../EditorSession.js";
import type { AttributeChange } from "../extensions/AttributeHandler.js";
import type { CommandResult } from "./CommandResult.js";
import type { PreparedEdit } from "./PreparedEdit.js";

export class AttributeHandlerEdit implements PreparedEdit<EditorSession> {
  constructor(private readonly change: AttributeChange) {}

  apply(): CommandResult {
    this.change.apply();
    return {
      success: true,
      message: this.change.message,
      affectedIds: this.change.affectedIds
    };
  }

  revert(): CommandResult {
    this.change.revert();
    return {
      success: true,
      message: this.change.undoMessage,
      affectedIds: this.change.affectedIds
    };
  }
}
