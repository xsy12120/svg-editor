import type { Document } from "../../domain/model/Document.js";
import type { ShapeAttribute } from "../../domain/shapes/ShapeDescriptor.js";

export interface TreeDecorationTarget {
  readonly id: string;
  readonly typeName: string;
  readonly attributes: readonly ShapeAttribute[];
  readonly isRoot: boolean;
  readonly parentId: string | null;
}

export interface TreeDecorationContext {
  readonly document: Document;
  readonly rootId?: string;
}

export interface TreeDecorator {
  readonly name: string;
  readonly priority: number;
  decorate(
    target: TreeDecorationTarget,
    context: TreeDecorationContext
  ): readonly string[];
}

export interface TreeDecorationResolver {
  decorate(
    target: TreeDecorationTarget,
    context: TreeDecorationContext
  ): readonly string[];
}
