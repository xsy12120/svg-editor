import { describe, expect, it } from "vitest";

import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import type { ShapeProvider } from "../../src/application/shapes/ShapeProvider.js";
import {
  GroupProvider,
  RectProvider
} from "../../src/plugins/builtin-shapes/index.js";
import { Group } from "../../src/domain/shapes/Group.js";

function specialProvider(priority: number): ShapeProvider {
  return {
    typeName: `special-${priority}`,
    svgMatchPriority: priority,
    matchesSvgElement: (element) =>
      element.tagName === "g" &&
      element.attributes["data-kind"] === "special",
    createFromCliArgs(): never {
      throw new Error("not used");
    },
    create(init) {
      return new Group(init.id);
    },
    createFromSvg: (request) => new Group(request.id)
  };
}

describe("ShapeProvider SVG read resolution", () => {
  it("resolves the regular element tag to its provider type", () => {
    const factory = new ShapeFactory();
    factory.register(new RectProvider());

    expect(
      factory.resolveSvgType({ tagName: "rect", attributes: {} })
    ).toBe("rect");
  });

  it("prefers the more specific matching SVG provider", () => {
    const factory = new ShapeFactory();
    factory.register(new GroupProvider());
    factory.register(specialProvider(10));

    expect(
      factory.resolveSvgType({
        tagName: "g",
        attributes: { "data-kind": "special" }
      })
    ).toBe("special-10");
  });

  it("falls back to the ordinary group provider without the specialized plugin", () => {
    const factory = new ShapeFactory();
    factory.register(new GroupProvider());

    expect(
      factory.resolveSvgType({
        tagName: "g",
        attributes: { "data-kind": "special" }
      })
    ).toBe("g");
  });

  it("rejects equally specific SVG providers", () => {
    const factory = new ShapeFactory();
    factory.register(specialProvider(10));
    factory.register({
      ...specialProvider(10),
      typeName: "another-special"
    });

    expect(() =>
      factory.resolveSvgType({
        tagName: "g",
        attributes: { "data-kind": "special" }
      })
    ).toThrow("ambiguous SVG element providers: g");
  });
});
