import type { Position, TextDocument } from "vscode";
import { describe, expect, it } from "vitest";

import { parseSvgOutline } from "../src/svgOutlineParser.js";
import { SvgOutlineSymbolMapper } from "../src/svgOutlineSymbolMapper.js";

function textDocument(source: string): TextDocument {
  return {
    getText(): string {
      return source;
    },
    positionAt(offset: number): Position {
      const prefix = source.slice(0, offset);
      const lines = prefix.split(/\r\n|\r|\n/);
      return {
        line: lines.length - 1,
        character: lines.at(-1)?.length ?? 0
      } as Position;
    }
  } as unknown as TextDocument;
}

describe("SvgOutlineSymbolMapper", () => {
  it("maps an outline tree recursively into DocumentSymbols", () => {
    const source = [
      '<svg id="root">',
      '  <g id="layer">',
      '    <rect id="box"/>',
      '    <text>Label</text>',
      "  </g>",
      "</svg>"
    ].join("\n");
    const root = parseSvgOutline(source);
    if (root === null) {
      throw new Error("test fixture must produce a valid outline");
    }

    const symbols = new SvgOutlineSymbolMapper().map(
      textDocument(source),
      root
    );

    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe("svg#root");
    expect(symbols[0]?.children?.[0]?.name).toBe("g#layer");
    expect(
      symbols[0]?.children?.[0]?.children?.map((child) => child.name)
    ).toEqual(["rect#box", "text"]);
  });

  it("maps source offsets to full and selection ranges", () => {
    const source = '<svg id="root">\n  <rect id="box"/>\n</svg>';
    const root = parseSvgOutline(source);
    if (root === null) {
      throw new Error("test fixture must produce a valid outline");
    }

    const rect = new SvgOutlineSymbolMapper()
      .map(textDocument(source), root)[0]?.children?.[0];

    expect(rect?.range.start).toEqual({ line: 1, character: 2 });
    expect(rect?.selectionRange).toEqual({
      start: { line: 1, character: 3 },
      end: { line: 1, character: 7 }
    });
  });
});
