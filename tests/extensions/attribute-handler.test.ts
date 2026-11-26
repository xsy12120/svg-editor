import { describe, expect, it, vi } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import type {
  AttributeChange,
  AttributeHandler
} from "../../src/application/extensions/AttributeHandler.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { SetAttributeCommandProvider } from "../../src/application/commands/SetAttributeCommandProvider.js";
import { Rect } from "../../src/domain/shapes/Rect.js";

function createSession(): EditorSession {
  const session = new EditorSession();
  const document = session.initializeCanvas(400, 200);
  document.addShape(
    new Rect({ id: "r1", x: 10, y: 20, width: 30, height: 40 })
  );
  return session;
}

function handler(
  name: string,
  supports: boolean,
  onApply: () => void
): AttributeHandler {
  return {
    name,
    handles: () => supports,
    prepare(): AttributeChange {
      return {
        affectedIds: ["r1"],
        message: `${name} applied`,
        undoMessage: `${name} reverted`,
        apply: onApply,
        revert(): void {}
      };
    }
  };
}

describe("AttributeHandler extension point", () => {
  it("routes matching attributes through the registered handler", () => {
    const registry = new AttributeHandlerRegistry();
    const apply = vi.fn();
    registry.register(handler("custom-fill", true, apply));
    const command = new SetAttributeCommandProvider(registry).create([
      "r1",
      "fill",
      "red"
    ]);
    const session = createSession();
    const edit = command.prepare(session);

    const result = edit.apply(session);

    expect(apply).toHaveBeenCalledOnce();
    expect(result.message).toBe("custom-fill applied");
    expect(result.affectedIds).toEqual(["r1"]);
  });

  it("rejects ambiguous handlers before modifying the document", () => {
    const registry = new AttributeHandlerRegistry();
    registry.register(handler("first", true, () => {}));
    registry.register(handler("second", true, () => {}));
    const session = createSession();
    const shape = session.document?.findShape("r1");
    const command = new SetAttributeCommandProvider(registry).create([
      "r1",
      "fill",
      "red"
    ]);

    expect(() => command.prepare(session)).toThrow(
      "multiple attribute handlers: r1/fill"
    );
    expect(shape?.getAttribute("fill")).toBeUndefined();
  });

  it("rejects duplicate handler names", () => {
    const registry = new AttributeHandlerRegistry();
    registry.register(handler("duplicate", true, () => {}));

    expect(() =>
      registry.register(handler("duplicate", false, () => {}))
    ).toThrow("attribute handler already registered: duplicate");
  });

  it("falls back to the Phase 1 attribute rules when no handler matches", () => {
    const registry = new AttributeHandlerRegistry();
    registry.register(handler("unrelated", false, () => {}));
    const session = createSession();
    const command = new SetAttributeCommandProvider(registry).create([
      "r1",
      "fill",
      "red"
    ]);

    command.prepare(session).apply(session);

    expect(session.document?.findShape("r1")?.getAttribute("fill")).toBe(
      "red"
    );
  });
});
