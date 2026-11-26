import type {
  AttributeChange,
  AttributeHandler,
  Shape
} from "svg-editor-pj1/plugin-api";

import { Box } from "./Box.js";

export class BoxAttributeHandler implements AttributeHandler {
  readonly name = "box-attributes";

  handles(shape: Shape, attribute: string): boolean {
    return (
      shape.semanticTypeName === "box" &&
      (attribute === "fill" || attribute === "label")
    );
  }

  prepare(
    shape: Shape,
    attribute: string,
    value: string
  ): AttributeChange {
    if (!(shape instanceof Box)) {
      throw new Error(`invalid box target: ${shape.id}`);
    }
    if (attribute === "fill") {
      const previous = shape.body.getAttribute("fill");
      return {
        affectedIds: [shape.body.id],
        message: `box#${shape.id} fill propagated to ${shape.body.id}`,
        undoMessage: `box#${shape.id} fill restored: ${display(previous)}`,
        apply(): void {
          shape.body.setAttribute("fill", value);
        },
        revert(): void {
          shape.body.setAttribute("fill", previous);
        }
      };
    }
    if (attribute === "label") {
      const previous = shape.label.getAttribute("text") ?? "";
      return {
        affectedIds: [shape.label.id],
        message: `box#${shape.id} label updated: ${display(value)}`,
        undoMessage: `box#${shape.id} label restored: ${display(previous)}`,
        apply(): void {
          shape.label.setAttribute("text", value);
        },
        revert(): void {
          shape.label.setAttribute("text", previous);
        }
      };
    }
    throw new Error(`unknown attribute: ${attribute}`);
  }
}

function display(value: string | undefined): string {
  return value === undefined ? "<unset>" : `"${value}"`;
}
