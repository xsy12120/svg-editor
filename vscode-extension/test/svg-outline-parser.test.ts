import { describe, expect, it } from "vitest";

import { parseSvgOutline } from "../src/svgOutlineParser.js";

describe("parseSvgOutline", () => {
  it("preserves the nested SVG hierarchy and source order", () => {
    const source = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg id="root" width="800" height="600">',
      "  <g id=\"flowchart\">",
      '    <rect id="start" x="10" y="20" width="30" height="40"/>',
      '    <text id="label" x="15" y="45">Start</text>',
      "  </g>",
      '  <line id="arrow"/>',
      "</svg>"
    ].join("\n");

    const root = parseSvgOutline(source);

    expect(root).not.toBeNull();
    expect(root?.tagName).toBe("svg");
    expect(root?.id).toBe("root");
    expect(root?.children.map((child) => child.tagName)).toEqual([
      "g",
      "line"
    ]);
    expect(root?.children[0]?.children.map((child) => child.tagName)).toEqual([
      "rect",
      "text"
    ]);
    expect(root?.children[0]?.children[0]?.id).toBe("start");
    expect(root?.children[0]?.children[1]?.id).toBe("label");
  });

  it("supports elements without an id", () => {
    const source = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      "  <g>",
      '    <text x="10" y="20">hello</text>',
      "  </g>",
      "</svg>"
    ].join("\n");

    const root = parseSvgOutline(source);
    const group = root?.children[0];
    const text = group?.children[0];

    expect(group?.tagName).toBe("g");
    expect(group?.id).toBeUndefined();
    expect(text?.tagName).toBe("text");
    expect(text?.id).toBeUndefined();
  });

  it("records full ranges and exact tag-name selection ranges", () => {
    const source = [
      '<svg id="root">',
      '  <rect x="1" id="box" y="2" />',
      "</svg>"
    ].join("\n");

    const root = parseSvgOutline(source);
    const rect = root?.children[0];
    const rectOpenStart = source.indexOf("<rect");
    const rectOpenEnd = source.indexOf("/>", rectOpenStart) + 2;

    expect(root?.range.start).toBe(source.indexOf("<svg"));
    expect(root?.range.end).toBe(source.indexOf("</svg>") + "</svg>".length);
    expect(rect?.range.start).toBe(rectOpenStart);
    expect(rect?.range.end).toBe(rectOpenEnd);
    expect(
      source.slice(
        rect?.selectionRange.start,
        rect?.selectionRange.end
      )
    ).toBe("rect");
    expect(rect?.id).toBe("box");
  });

  it("ignores declarations, comments, and literal text nodes", () => {
    const source = [
      '<?xml version="1.0"?>',
      "<!-- before root -->",
      '<svg id="root">',
      "  raw text between elements",
      "  <!-- inner comment -->",
      "  <g/>",
      "</svg>",
      "<!-- after root -->"
    ].join("\n");

    const root = parseSvgOutline(source);

    expect(root?.children).toHaveLength(1);
    expect(root?.children[0]?.tagName).toBe("g");
    expect(root?.children[0]?.children).toEqual([]);
  });

  it("uses UTF-16 offsets that remain correct with CRLF and Chinese text", () => {
    const source = [
      '<svg id="root">',
      '  <text id="label">处理数据</text>',
      "</svg>"
    ].join("\r\n");

    const root = parseSvgOutline(source);
    const text = root?.children[0];
    const textStart = source.indexOf("<text");
    const textEnd =
      source.indexOf("</text>", textStart) + "</text>".length;

    expect(text?.range.start).toBe(textStart);
    expect(text?.range.end).toBe(textEnd);
    expect(
      source.slice(
        text?.selectionRange.start,
        text?.selectionRange.end
      )
    ).toBe("text");
  });

  it.each([
    {
      description: "an element with no closing tag",
      source: '<svg id="root"><g id="layer">'
    },
    {
      description: "a half-written opening tag",
      source: '<svg id="root"><rect id="box"'
    },
    {
      description: "an unclosed attribute quote",
      source: '<svg id="root><g/></svg>'
    },
    {
      description: "an empty document",
      source: ""
    },
    {
      description: "a declaration without an SVG root",
      source: '<?xml version="1.0"?>'
    },
    {
      description: "a valid document after an edit made it incomplete",
      source: [
        '<svg id="root">',
        '  <g id="layer">',
        '    <rect id="box"/>',
        "  </g>"
      ].join("\n")
    }
  ])("returns null for $description", ({ source }) => {
    expect(parseSvgOutline(source)).toBeNull();
  });
});
