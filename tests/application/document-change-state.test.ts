import { describe, expect, it } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { SetAttributeCommandProvider } from "../../src/application/commands/SetAttributeCommandProvider.js";
import { SaveDocumentCommand } from "../../src/application/commands/SaveDocumentCommand.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { CommandInvoker } from "../../src/application/history/CommandInvoker.js";
import type { FileStore } from "../../src/application/ports/FileStore.js";
import type { SvgCodec } from "../../src/application/ports/SvgCodec.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";

describe("EditorSession document change state", () => {
  it("tracks content changes against the saved state", () => {
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

    expect(session.changes.isDirty).toBe(false);

    rect.setAttribute("fill", "red");
    expect(session.changes.isDirty).toBe(true);
    expect([...session.changes.changedIds]).toEqual(["rect"]);

    rect.setAttribute("fill", undefined);
    expect(session.changes.isDirty).toBe(false);
    expect(session.changes.changedIds.size).toBe(0);
  });

  it("marks changed descendants and their ancestors", () => {
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

    expect([...session.changes.changedIds].sort()).toEqual([
      "group",
      "rect"
    ]);
    expect(session.changes.isDirty).toBe(true);
  });

  it("tracks canvas dimension changes separately from shape ids", () => {
    const session = new EditorSession();
    const document = session.initializeCanvas(100, 100);
    session.markSaved();

    document.resize(200, 100);

    expect(session.changes.rootChanged).toBe(true);
    expect(session.changes.isDirty).toBe(true);
    expect(session.changes.changedIds.size).toBe(0);
  });

  it("clears changes when undo returns to the saved content", () => {
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
    const invoker = new CommandInvoker(session);

    invoker.execute(
      new SetAttributeCommandProvider(
        new AttributeHandlerRegistry()
      ).create(["rect", "fill", "red"])
    );
    expect(session.changes.isDirty).toBe(true);

    invoker.undo();
    expect(session.changes.isDirty).toBe(false);
  });

  it("marks the current content as saved after a successful save", () => {
    const session = new EditorSession();
    const document = session.initializeCanvas(100, 100);
    document.addShape(
      new Rect({ id: "rect", x: 0, y: 0, width: 10, height: 10 })
    );
    const files: FileStore = {
      read: () => "",
      write: () => {}
    };
    const codec: SvgCodec = {
      encode: () => "<svg/>",
      decode: () => ({ document, warnings: [] })
    };
    const save = new SaveDocumentCommand("saved.svg", files, codec);

    expect(session.changes.isDirty).toBe(true);
    save.validate(session);
    save.execute(session);
    expect(session.changes.isDirty).toBe(false);
  });
});
