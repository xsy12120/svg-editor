import {
  Rect,
  type Shape,
  type ShapeInit,
  type ShapeProvider
} from "../../plugin-api/index.js";
import { createDefaultSvgShape } from "./ShapeProviderSupport.js";

export class RectProvider implements ShapeProvider {
  readonly typeName = "rect";
  readonly svgMatchPriority = 0;

  matchesSvgElement(element: { readonly tagName: string }): boolean {
    return element.tagName === this.typeName;
  }

  createFromCliArgs(args: readonly string[]): ShapeInit {
    if (args.length < 5 || args.length > 6) {
      throw new Error(
        "usage: create rect <id> <x> <y> <width> <height> [fill]"
      );
    }

    const [id, rawX, rawY, rawWidth, rawHeight, fill] = args;
    if (id === undefined || id.length === 0) {
      throw new Error("rect id is required");
    }

    const attributes: Record<string, string> = {
      x: this.requireValue(rawX, "rect x"),
      y: this.requireValue(rawY, "rect y"),
      width: this.requireValue(rawWidth, "rect width"),
      height: this.requireValue(rawHeight, "rect height")
    };
    if (fill !== undefined) {
      attributes["fill"] = fill;
    }

    return {
      typeName: this.typeName,
      id,
      attributes
    };
  }

  create(init: ShapeInit): Shape {
    if (init.typeName !== this.typeName) {
      throw new Error(`rect provider cannot create shape type: ${init.typeName}`);
    }

    const x = this.parseNumber(init.attributes["x"], "rect x");
    const y = this.parseNumber(init.attributes["y"], "rect y");
    const width = this.parseNumber(init.attributes["width"], "rect width");
    const height = this.parseNumber(init.attributes["height"], "rect height");
    if (width <= 0) {
      throw new Error("rect width must be positive");
    }
    if (height <= 0) {
      throw new Error("rect height must be positive");
    }

    return new Rect({
      id: init.id,
      x,
      y,
      width,
      height
    });
  }

  createFromSvg(
    request: Parameters<ShapeProvider["createFromSvg"]>[0]
  ): Shape {
    return createDefaultSvgShape(this, request);
  }

  private requireValue(value: string | undefined, name: string): string {
    if (value === undefined) {
      throw new Error(`${name} is required`);
    }

    return value;
  }

  private parseNumber(value: string | undefined, name: string): number {
    const requiredValue = this.requireValue(value, name);

    const parsed = Number(requiredValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${name} must be a finite number`);
    }

    return parsed;
  }
}
