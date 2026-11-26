import type { Shape } from "../../domain/shapes/Shape.js";
import type { ShapeCreator } from "../ports/ShapeCreator.js";

export interface ShapeCatalog extends ShapeCreator {
  createFromCliArgs(typeName: string, args: readonly string[]): Shape;
}
