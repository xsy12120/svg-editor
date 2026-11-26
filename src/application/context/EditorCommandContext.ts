import type { ShapeDescriptor } from "../../domain/shapes/ShapeDescriptor.js";

export interface EditorShapeContext {
  readonly id: string;
  readonly children?: readonly EditorShapeContext[];
  toDescriptor(): ShapeDescriptor;
}

export interface EditorDocumentContext {
  readonly width: number;
  readonly height: number;
  readonly shapeCount: number;
  readonly shapes: readonly EditorShapeContext[];
  findShape(id: string): EditorShapeContext | undefined;
}

export interface EditorCommandContext {
  readonly document: EditorDocumentContext | null;
  readonly documentPath: string | null;
}
