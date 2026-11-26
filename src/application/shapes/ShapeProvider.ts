import type { Shape } from "../../domain/shapes/Shape.js";
import type { SvgElementDescriptor } from "../ports/SvgShapeReader.js";
import type { ShapeInit } from "./ShapeInit.js";

export interface ShapeProvider {
  readonly typeName: string;
  readonly svgMatchPriority?: number;
  matchesSvgElement(element: SvgElementDescriptor): boolean;
  createFromCliArgs(args: readonly string[]): ShapeInit;
  create(init: ShapeInit): Shape;
}
