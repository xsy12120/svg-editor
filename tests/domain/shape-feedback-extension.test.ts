import { describe, expect, it } from "vitest";

import { ShapeFeedback } from "../../src/application/commands/ShapeFeedback.js";
import { Group } from "../../src/domain/shapes/Group.js";

class SemanticGroup extends Group {
  override get semanticTypeName(): string {
    return "semantic-group";
  }

  override get creationDetails(): readonly string[] {
    return [`g#${this.id}`, `extra#${this.id}-extra`];
  }
}

describe("shape semantic feedback extension", () => {
  it("allows a shape to override its semantic type and creation details", () => {
    const shape = new SemanticGroup("n1");

    expect(ShapeFeedback.created(shape)).toBe(
      "semantic-group#n1 created (g#n1 + extra#n1-extra)"
    );
    expect(ShapeFeedback.reference(shape)).toBe("semantic-group#n1");
  });
});
