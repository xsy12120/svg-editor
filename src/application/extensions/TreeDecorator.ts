import type { ShapeAttribute } from "../../domain/shapes/ShapeDescriptor.js";
import type { EditorDocumentContext } from "../context/EditorCommandContext.js";
import type { DocumentChangeState } from "../context/DocumentChangeState.js";

export interface TreeDecorationTarget {
  readonly id: string;
  readonly typeName: string;
  readonly semanticTypeName: string;
  readonly attributes: readonly ShapeAttribute[];
  readonly isRoot: boolean;
  readonly parentId: string | null;
}

export interface TreeDecorationContext {
  readonly document: EditorDocumentContext;
  readonly rootId?: string;
  readonly changes: DocumentChangeState;
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
