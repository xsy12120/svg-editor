import {
  Line,
  type Shape,
  type ShapeInit,
  type ShapeProvider
} from "../../plugin-api/index.js";
import {
  assertShapeType,
  createDefaultSvgShape,
  parseFiniteNumber,
  requireAttribute,
  requireShapeId
} from "./ShapeProviderSupport.js";

export class LineProvider implements ShapeProvider {
  readonly typeName = "line";
  readonly svgMatchPriority = 0;

  matchesSvgElement(element: { readonly tagName: string }): boolean {
    return element.tagName === this.typeName;
  }

  createFromCliArgs(args: readonly string[]): ShapeInit {
    if (args.length < 5 || args.length > 6) {
      throw new Error(
        "usage: create line <id> <x1> <y1> <x2> <y2> [stroke]"
      );
    }

    const [rawId, x1, y1, x2, y2, stroke] = args;
    const attributes: Record<string, string> = {
      x1: requireAttribute(x1, "line x1"),
      y1: requireAttribute(y1, "line y1"),
      x2: requireAttribute(x2, "line x2"),
      y2: requireAttribute(y2, "line y2")
    };
    if (stroke !== undefined) {
      attributes["stroke"] = stroke;
    }

    return {
      typeName: this.typeName,
      id: requireShapeId(rawId, "line"),
      attributes
    };
  }

  create(init: ShapeInit): Shape {
    assertShapeType(init, this.typeName);
    return new Line({
      id: init.id,
      x1: parseFiniteNumber(init.attributes["x1"], "line x1"),
      y1: parseFiniteNumber(init.attributes["y1"], "line y1"),
      x2: parseFiniteNumber(init.attributes["x2"], "line x2"),
      y2: parseFiniteNumber(init.attributes["y2"], "line y2")
    });
  }

  createFromSvg(
    request: Parameters<ShapeProvider["createFromSvg"]>[0]
  ): Shape {
    return createDefaultSvgShape(this, request);
  }
}
