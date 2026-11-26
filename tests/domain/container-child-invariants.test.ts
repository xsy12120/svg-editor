import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { AddToCommand } from "../../src/application/commands/AddToCommand.js";
import { DeleteShapeCommand } from "../../src/application/commands/DeleteShapeCommand.js";
import { CommandInvoker } from "../../src/application/history/CommandInvoker.js";
import { ContainerShape } from "../../src/domain/shapes/ContainerShape.js";
import type {
  ShapeAttribute,
  ShapeDescriptor
} from "../../src/domain/shapes/ShapeDescriptor.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";

class SealedContainer extends ContainerShape {
  override get svgTagName(): string {
    return "g";
  }

  override toSvgAttributes(): readonly ShapeAttribute[] {
    return [];
  }

  override move(): void {}

  override scale(): void {}

  override captureGeometryState(): { restore(): void } {
    return { restore(): void {} };
  }

  override getAttribute(): undefined {
    return undefined;
  }

  override setAttribute(): void {}

  override toDescriptor(): ShapeDescriptor {
    return { typeName: "sealed", id: this.id, attributes: [] };
  }

  override validateChildRemoval(child: { readonly id: string }): void {
    if (child.id === "required") {
      throw new Error(`cannot remove required child: ${child.id}`);
    }
  }
}

function createHarness() {
  const session = new EditorSession();
  const document = session.initializeCanvas(100, 100);
  const sealed = new SealedContainer("sealed");
  const required = new Rect({
    id: "required",
    x: 0,
    y: 0,
    width: 10,
    height: 10
  });
  sealed.addChild(required);
  document.addShape(sealed);
  return { session, document, sealed, required, invoker: new CommandInvoker(session) };
}

describe("container child removal invariants", () => {
  it("rejects deleting a required child without changing the document", () => {
    const { document, sealed, invoker } = createHarness();

    expect(() =>
      invoker.execute(new DeleteShapeCommand("required"))
    ).toThrow("cannot remove required child: required");
    expect(sealed.children.map((child) => child.id)).toEqual(["required"]);
    expect(document.findShape("required")?.id).toBe("required");
    expect(() => invoker.undo()).toThrow("nothing to undo");
  });

  it("rejects moving a required child to another container", () => {
    const { document, sealed, invoker } = createHarness();
    const target = new Group("target");
    document.addShape(target);

    expect(() =>
      invoker.execute(new AddToCommand("target", "required"))
    ).toThrow("cannot remove required child: required");
    expect(sealed.children.map((child) => child.id)).toEqual(["required"]);
    expect(target.children).toEqual([]);
    expect(document.findShape("required")?.id).toBe("required");
  });
});
