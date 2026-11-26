import {
  Group,
  type Shape,
  type ShapeInit,
  type ShapeProvider
} from "svg-editor-pj1/plugin-api";
import { assertShapeType, requireShapeId } from "./ShapeProviderSupport.js";

export class GroupProvider implements ShapeProvider {
  readonly typeName = "g";
  readonly svgMatchPriority = 0;

  matchesSvgElement(element: { readonly tagName: string }): boolean {
    return element.tagName === "g";
  }

  createFromCliArgs(args: readonly string[]): ShapeInit {
    if (args.length !== 1) {
      throw new Error("usage: create g <id>");
    }

    return {
      typeName: this.typeName,
      id: requireShapeId(args[0], "group"),
      attributes: {}
    };
  }

  create(init: ShapeInit): Shape {
    assertShapeType(init, this.typeName);
    return new Group(init.id);
  }

  createFromSvg(
    request: Parameters<ShapeProvider["createFromSvg"]>[0]
  ): Shape {
    const group = new Group(request.id);
    for (const child of request.children) {
      group.addChild(child);
    }
    return group;
  }
}
