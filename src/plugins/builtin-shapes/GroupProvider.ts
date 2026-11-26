import {
  Group,
  type Shape,
  type ShapeInit,
  type ShapeProvider
} from "svg-editor-pj1/plugin-api";
import {
  applyCommonStyleAttributes,
  assertShapeType,
  requireShapeId
} from "./ShapeProviderSupport.js";

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
    const group = new Group(init.id);
    applyCommonStyleAttributes(group, init.attributes);
    return group;
  }

  createFromSvg(
    request: Parameters<ShapeProvider["createFromSvg"]>[0]
  ): Shape {
    const group = this.create({
      typeName: this.typeName,
      id: request.id,
      attributes: request.attributes
    }) as Group;
    for (const child of request.children) {
      group.addChild(child);
    }
    return group;
  }
}
