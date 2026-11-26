import {
  Text,
  type Shape,
  type ShapeInit,
  type ShapeProvider
} from "../../plugin-api/index.js";
import {
  assertShapeType,
  createDefaultSvgShape,
  parseFiniteNumber,
  parsePositiveNumber,
  requireAttribute,
  requireShapeId
} from "./ShapeProviderSupport.js";

export class TextProvider implements ShapeProvider {
  readonly typeName = "text";
  readonly svgMatchPriority = 0;

  matchesSvgElement(element: { readonly tagName: string }): boolean {
    return element.tagName === this.typeName;
  }

  createFromCliArgs(args: readonly string[]): ShapeInit {
    if (args.length !== 4) {
      throw new Error('usage: create text <id> <x> <y> "<content>"');
    }

    const [rawId, x, y, content] = args;
    return {
      typeName: this.typeName,
      id: requireShapeId(rawId, "text"),
      attributes: {
        x: requireAttribute(x, "text x"),
        y: requireAttribute(y, "text y"),
        text: requireAttribute(content, "text content")
      }
    };
  }

  create(init: ShapeInit): Shape {
    assertShapeType(init, this.typeName);
    return new Text({
      id: init.id,
      x: parseFiniteNumber(init.attributes["x"], "text x"),
      y: parseFiniteNumber(init.attributes["y"], "text y"),
      content: requireAttribute(init.attributes["text"], "text content"),
      ...(init.attributes["font-size"] === undefined
        ? {}
        : {
            fontSize: parsePositiveNumber(
              init.attributes["font-size"],
              "text font-size"
            )
          }),
      ...(init.attributes["text-anchor"] === undefined
        ? {}
        : { textAnchor: init.attributes["text-anchor"] })
    });
  }

  createFromSvg(
    request: Parameters<ShapeProvider["createFromSvg"]>[0]
  ): Shape {
    return createDefaultSvgShape(this, request);
  }
}
