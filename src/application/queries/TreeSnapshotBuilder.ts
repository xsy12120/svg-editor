import type { Document } from "../../domain/model/Document.js";
import { ContainerShape } from "../../domain/shapes/ContainerShape.js";
import type { Shape } from "../../domain/shapes/Shape.js";
import type {
  DocumentChangeState
} from "../context/DocumentChangeState.js";
import {
  EMPTY_DOCUMENT_CHANGE_STATE
} from "../context/DocumentChangeState.js";
import type {
  TreeDecorationContext,
  TreeDecorationResolver,
  TreeDecorationTarget
} from "../extensions/TreeDecorator.js";
import type {
  TreeSnapshot,
  TreeSnapshotNode
} from "./TreeSnapshot.js";

export class TreeSnapshotBuilder {
  constructor(
    private readonly decorators: TreeDecorationResolver
  ) {}

  build(
    document: Document,
    rootId?: string,
    changes: DocumentChangeState = EMPTY_DOCUMENT_CHANGE_STATE
  ): TreeSnapshot {
    const context: TreeDecorationContext =
      rootId === undefined
        ? { document, changes }
        : { document, rootId, changes };
    const decorations =
      rootId === undefined
        ? this.decorators.decorate(
            {
              id: "svg",
              typeName: "svg",
              semanticTypeName: "svg",
              attributes: [],
              isRoot: true,
              parentId: null
            },
            context
          )
        : [];

    if (rootId !== undefined) {
      const root = document.findShape(rootId);
      if (root === undefined) {
        throw new Error(`no such shape: ${rootId}`);
      }
      return {
        width: document.width,
        height: document.height,
        decorations,
        root: this.createNode(root, context, null),
        roots: []
      };
    }

    return {
      width: document.width,
      height: document.height,
      decorations,
      root: null,
      roots: document.shapes.map((shape) =>
        this.createNode(shape, context, null)
      )
    };
  }

  private createNode(
    shape: Shape,
    context: TreeDecorationContext,
    parentId: string | null
  ): TreeSnapshotNode {
    const descriptor = shape.toDescriptor();
    const target: TreeDecorationTarget = {
      id: descriptor.id,
      typeName: descriptor.typeName,
      semanticTypeName: shape.semanticTypeName,
      attributes: descriptor.attributes,
      isRoot: false,
      parentId
    };
    return {
      id: descriptor.id,
      typeName: descriptor.typeName,
      attributes: descriptor.attributes,
      decorations: this.decorators.decorate(target, context),
      children:
        shape instanceof ContainerShape
          ? shape.children.map((child) =>
              this.createNode(child, context, shape.id)
            )
          : []
    };
  }
}
