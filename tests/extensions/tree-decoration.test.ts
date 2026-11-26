import { describe, expect, it } from "vitest";

import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import type {
  TreeDecorationContext,
  TreeDecorator,
  TreeDecorationTarget
} from "../../src/application/extensions/TreeDecorator.js";
import { TreeSnapshotBuilder } from "../../src/application/queries/TreeSnapshotBuilder.js";
import { EMPTY_DOCUMENT_CHANGE_STATE } from "../../src/application/context/DocumentChangeState.js";
import { Document } from "../../src/domain/model/Document.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { CliTreeRenderer } from "../../src/interfaces/cli/CliTreeRenderer.js";

function decorator(
  name: string,
  priority: number,
  labels: (target: TreeDecorationTarget) => readonly string[]
): TreeDecorator {
  return {
    name,
    priority,
    decorate: labels
  };
}

function createDocument(): Document {
  const document = new Document(400, 200);
  const group = new Group("g1");
  group.addChild(
    new Rect({ id: "r1", x: 10, y: 20, width: 30, height: 40 })
  );
  document.addShape(group);
  return document;
}

describe("TreeDecorator extension point", () => {
  it("orders labels by priority and then by stable decorator name", () => {
    const registry = new TreeDecoratorRegistry();
    registry.register(decorator("modified-star", 20, () => ["*"]));
    registry.register(decorator("box", 10, () => ["(box)"]));
    registry.register(decorator("other", 20, () => ["other"]));

    const context: TreeDecorationContext = {
      document: createDocument(),
      changes: EMPTY_DOCUMENT_CHANGE_STATE
    };
    const target: TreeDecorationTarget = {
      id: "g1",
      typeName: "g",
      attributes: [],
      isRoot: false,
      parentId: null
    };

    expect(registry.decorate(target, context)).toEqual([
      "(box)",
      "*",
      "other"
    ]);
  });

  it("rejects duplicate decorator names", () => {
    const registry = new TreeDecoratorRegistry();
    registry.register(decorator("duplicate", 0, () => []));

    expect(() =>
      registry.register(decorator("duplicate", 1, () => []))
    ).toThrow("tree decorator already registered: duplicate");
  });

  it("adds generic decorations to the snapshot without changing attributes", () => {
    const document = createDocument();
    const registry = new TreeDecoratorRegistry();
    registry.register(
      decorator("root-label", 0, (target) =>
        target.isRoot ? ["root"] : []
      )
    );
    registry.register(
      decorator("group-label", 0, (target) =>
        target.typeName === "g" ? ["(group)"] : []
      )
    );

    const snapshot = new TreeSnapshotBuilder(registry).build(document);

    expect(snapshot.decorations).toEqual(["root"]);
    expect(snapshot.roots[0]?.decorations).toEqual(["(group)"]);
    expect(snapshot.roots[0]?.children[0]?.decorations).toEqual([]);
  });

  it("renders decorations at the end of lines", () => {
    const document = createDocument();
    const registry = new TreeDecoratorRegistry();
    registry.register(
      decorator("root-label", 0, (target) =>
        target.isRoot ? ["root"] : []
      )
    );
    registry.register(
      decorator("group-label", 0, (target) =>
        target.typeName === "g" ? ["(group)"] : []
      )
    );
    const snapshot = new TreeSnapshotBuilder(registry).build(document);

    expect(new CliTreeRenderer().render(snapshot)).toBe(
      [
        "svg (400x200) root",
        "└── g#g1 (group)",
        "    └── rect#r1 x=10 y=20 w=30 h=40"
      ].join("\n")
    );
  });

  it("keeps the tree unchanged when no decorators are registered", () => {
    const snapshot = new TreeSnapshotBuilder().build(createDocument());

    expect(new CliTreeRenderer().render(snapshot)).toBe(
      [
        "svg (400x200)",
        "└── g#g1",
        "    └── rect#r1 x=10 y=20 w=30 h=40"
      ].join("\n")
    );
  });
});
