import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import type { TreeDecorator } from "../../src/application/extensions/TreeDecorator.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { TreeSnapshotBuilder } from "../../src/application/queries/TreeSnapshotBuilder.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { CliTreeRenderer } from "../../src/interfaces/cli/CliTreeRenderer.js";

const modifiedStar: TreeDecorator = {
  name: "modified-star",
  priority: 10,
  decorate(target, context): readonly string[] {
    if (target.isRoot) {
      return context.changes.isDirty ? ["*"] : [];
    }
    return context.changes.changedIds.has(target.id) ? ["*"] : [];
  }
};

describe("TreeDecorationContext change state", () => {
  it("allows a decorator to mark changed nodes and the root", () => {
    const session = new EditorSession();
    const document = session.initializeCanvas(100, 100);
    const group = new Group("group");
    const rect = new Rect({
      id: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10
    });
    group.addChild(rect);
    document.addShape(group);
    session.markSaved();
    rect.setAttribute("fill", "red");
    const decorators = new TreeDecoratorRegistry();
    decorators.register(modifiedStar);

    const snapshot = new TreeSnapshotBuilder(decorators).build(
      document,
      undefined,
      session.changes
    );

    expect(new CliTreeRenderer().render(snapshot)).toBe(
      [
        "svg (100x100) *",
        "└── g#group *",
        "    └── rect#rect x=0 y=0 w=10 h=10 fill=red *"
      ].join("\n")
    );
  });

  it("removes the star after undo returns to the saved state", () => {
    const session = new EditorSession();
    const document = session.initializeCanvas(100, 100);
    const rect = new Rect({
      id: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10
    });
    document.addShape(rect);
    session.markSaved();
    const decorators = new TreeDecoratorRegistry();
    decorators.register(modifiedStar);
    const builder = new TreeSnapshotBuilder(decorators);

    rect.setAttribute("fill", "red");
    expect(
      builder.build(document, undefined, session.changes).decorations
    ).toEqual(["*"]);

    rect.setAttribute("fill", undefined);
    expect(
      builder.build(document, undefined, session.changes).decorations
    ).toEqual([]);
  });
});
