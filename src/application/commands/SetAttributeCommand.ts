import type { EditorSession } from "../EditorSession.js";
import type { AttributeHandlerResolver } from "../extensions/AttributeHandler.js";
import { AttributeHandlerRegistry } from "../extensions/AttributeHandlerRegistry.js";
import { AttributeHandlerEdit } from "./AttributeHandlerEdit.js";
import type { PreparedEdit } from "./PreparedEdit.js";
import { SetAttributeEdit } from "./SetAttributeEdit.js";
import { requireShape } from "./ShapeCommandSupport.js";
import type { UndoableCommand } from "./UndoableCommand.js";

export class SetAttributeCommand implements UndoableCommand<EditorSession> {
  readonly kind = "edit";

  constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly value: string,
    private readonly handlers: AttributeHandlerResolver =
      new AttributeHandlerRegistry()
  ) {}

  prepare(session: EditorSession): PreparedEdit<EditorSession> {
    const shape = requireShape(session, this.id);
    const handler = this.handlers.resolve(shape, this.name);
    if (handler !== undefined) {
      return new AttributeHandlerEdit(
        handler.prepare(shape, this.name, this.value)
      );
    }

    const previousValue = shape.getAttribute(this.name);
    shape.setAttribute(this.name, this.value);
    shape.setAttribute(this.name, previousValue);
    return new SetAttributeEdit(
      shape,
      this.name,
      this.value,
      previousValue
    );
  }
}
