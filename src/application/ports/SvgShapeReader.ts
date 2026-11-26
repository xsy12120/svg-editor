import type { Shape } from "../../domain/shapes/Shape.js";

export interface SvgElementDescriptor {
  readonly tagName: string;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface SvgShapeReadRequest {
  readonly id: string;
  readonly element: SvgElementDescriptor;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly Shape[];
}

export interface SvgShapeReader {
  readSvgElement(request: SvgShapeReadRequest): Shape;
}
