import type { Document } from "../../domain/model/Document.js";
import { ContainerShape } from "../../domain/shapes/ContainerShape.js";
import type { Shape } from "../../domain/shapes/Shape.js";

export interface DocumentChangeState {
  readonly isDirty: boolean;
  readonly rootChanged: boolean;
  readonly changedIds: ReadonlySet<string>;
}

export interface DocumentStateSnapshot {
  readonly width: number;
  readonly height: number;
  readonly shapes: ReadonlyMap<string, ShapeStateSnapshot>;
}

interface ShapeStateSnapshot {
  readonly parentId: string | null;
  readonly index: number;
  readonly fingerprint: string;
}

export const EMPTY_DOCUMENT_CHANGE_STATE: DocumentChangeState = {
  isDirty: false,
  rootChanged: false,
  changedIds: new Set<string>()
};

export function captureDocumentState(
  document: Document
): DocumentStateSnapshot {
  const shapes = new Map<string, ShapeStateSnapshot>();
  const capture = (
    shape: Shape,
    parentId: string | null,
    index: number
  ): void => {
    const descriptor = shape.toDescriptor();
    shapes.set(shape.id, {
      parentId,
      index,
      fingerprint: JSON.stringify({
        typeName: descriptor.typeName,
        attributes: descriptor.attributes
      })
    });
    if (shape instanceof ContainerShape) {
      shape.children.forEach((child, childIndex) => {
        capture(child, shape.id, childIndex);
      });
    }
  };

  document.shapes.forEach((shape, index) => {
    capture(shape, null, index);
  });
  return {
    width: document.width,
    height: document.height,
    shapes
  };
}

export function compareDocumentState(
  document: Document,
  saved: DocumentStateSnapshot
): DocumentChangeState {
  const current = captureDocumentState(document);
  const directlyChanged = new Set<string>();

  for (const [id, shape] of current.shapes) {
    const previous = saved.shapes.get(id);
    if (
      previous === undefined ||
      previous.parentId !== shape.parentId ||
      previous.index !== shape.index ||
      previous.fingerprint !== shape.fingerprint
    ) {
      directlyChanged.add(id);
    }
  }
  for (const id of saved.shapes.keys()) {
    if (!current.shapes.has(id)) {
      directlyChanged.add(id);
    }
  }

  const changedIds = new Set(directlyChanged);
  for (const id of directlyChanged) {
    addAncestors(id, current.shapes, changedIds);
    addAncestors(id, saved.shapes, changedIds);
  }

  const rootChanged =
    current.width !== saved.width || current.height !== saved.height;
  return {
    isDirty: rootChanged || changedIds.size > 0,
    rootChanged,
    changedIds
  };
}

function addAncestors(
  id: string,
  shapes: ReadonlyMap<string, ShapeStateSnapshot>,
  target: Set<string>
): void {
  let current = shapes.get(id);
  while (current?.parentId !== null && current !== undefined) {
    target.add(current.parentId);
    current = shapes.get(current.parentId);
  }
}
