import { describe, expect, it, vi } from "vitest";

import type { ShapeProvider } from "../../src/application/shapes/ShapeProvider.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { XmlSvgCodec } from "../../src/infrastructure/svg/XmlSvgCodec.js";
import { RectProvider } from "../../src/plugins/builtin-shapes/index.js";

function compositeProvider(
  read: ShapeProvider["createFromSvg"]
): ShapeProvider {
  return {
    typeName: "special",
    svgMatchPriority: 10,
    matchesSvgElement: (element) =>
      element.tagName === "g" &&
      element.attributes["data-kind"] === "special",
    createFromCliArgs: () => {
      throw new Error("not used");
    },
    create: (init) => new Group(init.id),
    createFromSvg: read
  };
}

describe("SVG shape read lifecycle", () => {
  it("hands the completed child list to the matching provider", () => {
    const createFromSvg = vi.fn(
      (request: Parameters<ShapeProvider["createFromSvg"]>[0]) => {
        const group = new Group(request.id);
        for (const child of request.children) {
          group.addChild(child);
        }
        return group;
      }
    );
    const factory = new ShapeFactory();
    factory.register(new RectProvider());
    factory.register(compositeProvider(createFromSvg));
    const codec = new XmlSvgCodec(factory);

    const parsed = codec.decode(
      [
        '<svg width="100" height="100">',
        '  <g id="special" data-kind="special">',
        '    <rect id="child" x="1" y="2" width="3" height="4"/>',
        "  </g>",
        "</svg>"
      ].join("\n")
    );

    expect(createFromSvg).toHaveBeenCalledOnce();
    expect(createFromSvg.mock.calls[0]?.[0].children).toHaveLength(1);
    expect(
      parsed.document.findShape("special")?.toDescriptor().typeName
    ).toBe("g");
    expect(
      (parsed.document.findShape("special") as Group).children[0]?.id
    ).toBe("child");
  });

  it("rejects a malformed composite before it enters the document", () => {
    const factory = new ShapeFactory();
    factory.register(new RectProvider());
    factory.register(
      compositeProvider((request) => {
        if (request.children.length !== 2) {
          throw new Error("special element requires two children");
        }
        return new Group(request.id);
      })
    );
    const codec = new XmlSvgCodec(factory);

    expect(() =>
      codec.decode(
        '<svg width="100" height="100"><g id="special" data-kind="special"/></svg>'
      )
    ).toThrow("special element requires two children");
  });
});
