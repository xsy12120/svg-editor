import type { Shape } from "../../domain/shapes/Shape.js";
import type { ShapeCreator } from "./ShapeCreator.js";

export interface SvgElementDescriptor {
  readonly tagName: string;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface SvgShapeReader extends ShapeCreator {
  resolveSvgType(element: SvgElementDescriptor): string;
}
