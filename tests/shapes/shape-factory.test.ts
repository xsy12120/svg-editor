import { describe, expect, it, vi } from "vitest";

import { RectProvider } from "../../src/plugins/builtin-shapes/index.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import type { ShapeProvider } from "../../src/application/shapes/ShapeProvider.js";
import { Group } from "../../src/domain/shapes/Group.js";

function customProvider(): ShapeProvider {
  return {
    typeName: "custom",
    svgMatchPriority: 0,
    matchesSvgElement: () => true,
    createFromCliArgs: () => ({
      typeName: "custom",
      id: "custom",
      attributes: {}
    }),
    create: (init) => new Group(init.id),
    createFromSvg: vi.fn((request) => new Group(request.id))
  };
}

describe("ShapeFactory", () => {
  it("creates a rectangle from neutral shape initialization data", () => {
    const factory = new ShapeFactory();
    factory.register(new RectProvider());

    const shape = factory.create({
      typeName: "rect",
      id: "r1",
      attributes: {
        x: "10",
        y: "20",
        width: "100",
        height: "50",
        fill: "#f00"
      }
    });

    expect(shape.toDescriptor()).toEqual({
      typeName: "rect",
      id: "r1",
      attributes: [
        { name: "x", value: "10" },
        { name: "y", value: "20" },
        { name: "w", value: "100" },
        { name: "h", value: "50" },
        { name: "fill", value: "#f00" }
      ]
    });
  });

  it("leaves CLI shape attributes to the provider", () => {
    const factory = new ShapeFactory();
    factory.register(customProvider());

    const shape = factory.create({
      typeName: "custom",
      id: "custom",
      attributes: { fill: "red" }
    });

    expect(shape.getAttribute("fill")).toBeUndefined();
  });

  it("leaves SVG read attributes to the provider", () => {
    const provider = customProvider();
    const factory = new ShapeFactory();
    factory.register(provider);

    const shape = factory.readSvgElement({
      id: "custom",
      element: {
        tagName: "custom",
        attributes: { fill: "red" }
      },
      attributes: { fill: "red" },
      children: []
    });

    expect(provider.createFromSvg).toHaveBeenCalledOnce();
    expect(shape.getAttribute("fill")).toBeUndefined();
  });
});
