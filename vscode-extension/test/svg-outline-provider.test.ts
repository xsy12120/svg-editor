import type { Position, TextDocument } from "vscode";
import { describe, expect, it } from "vitest";

import { parseSvgOutline } from "../src/svgOutlineParser.js";
import { SvgOutlineDocumentSymbolProvider } from "../src/svgOutlineProvider.js";

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

describe("SvgOutlineDocumentSymbolProvider valid input mapping", () => {
  const source = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg id="root">',
    '  <g id="flowchart">',
    '    <rect id="start" x="10" y="20" width="30" height="40"/>',
    '    <text x="70" y="55">Start</text>',
    "  </g>",
    '  <line id="arrow"/>',
    "</svg>"
  ].join("\n");

  it("returns one root DocumentSymbol with nested children", async () => {
    const provider = new SvgOutlineDocumentSymbolProvider(parseSvgOutline);

    const symbols = await provider.provideDocumentSymbols(
      textDocument(source)
    );

    expect(symbols).toHaveLength(1);
    const root = symbols[0];
    expect(root?.name).toBe("svg#root");
    expect(root?.children?.map((child) => child.name)).toEqual([
      "g#flowchart",
      "line#arrow"
    ]);
    expect(
      root?.children?.[0]?.children?.map((child) => child.name)
    ).toEqual(["rect#start", "text"]);
  });

  it("uses tag#id when an id exists and tag alone otherwise", async () => {
    const provider = new SvgOutlineDocumentSymbolProvider(parseSvgOutline);

    const symbols = await provider.provideDocumentSymbols(
      textDocument(source)
    );

    const group = symbols[0]?.children?.[0];
    expect(group?.name).toBe("g#flowchart");
    expect(group?.children?.[0]?.name).toBe("rect#start");
    expect(group?.children?.[1]?.name).toBe("text");
    expect(symbols[0]?.children?.[1]?.name).toBe("line#arrow");
  });

  it("maps full element ranges and exact tag-name selection ranges", async () => {
    const provider = new SvgOutlineDocumentSymbolProvider(parseSvgOutline);

    const symbols = await provider.provideDocumentSymbols(
      textDocument(source)
    );

    const root = symbols[0];
    const group = root?.children?.[0];
    const rect = group?.children?.[0];

    expect(root?.range.start).toEqual({ line: 1, character: 0 });
    expect(root?.range.end).toEqual({ line: 7, character: 6 });
    expect(root?.selectionRange.start).toEqual({ line: 1, character: 1 });
    expect(root?.selectionRange.end).toEqual({ line: 1, character: 4 });

    expect(group?.range.start).toEqual({ line: 2, character: 2 });
    expect(group?.selectionRange).toEqual({
      start: { line: 2, character: 3 },
      end: { line: 2, character: 4 }
    });

    expect(rect?.range.start).toEqual({ line: 3, character: 4 });
    expect(rect?.selectionRange).toEqual({
      start: { line: 3, character: 5 },
      end: { line: 3, character: 9 }
    });
  });

  it("keeps parent ranges around all child ranges", async () => {
    const provider = new SvgOutlineDocumentSymbolProvider(parseSvgOutline);

    const symbols = await provider.provideDocumentSymbols(
      textDocument(source)
    );

    const root = symbols[0];
    const group = root?.children?.[0];
    const rect = group?.children?.[0];
    const text = group?.children?.[1];

    expect(isBeforeOrEqual(root?.range.start, group?.range.start)).toBe(true);
    expect(isBeforeOrEqual(group?.range.end, root?.range.end)).toBe(true);
    expect(isBeforeOrEqual(group?.range.start, rect?.range.start)).toBe(true);
    expect(isBeforeOrEqual(rect?.range.end, group?.range.end)).toBe(true);
    expect(isBeforeOrEqual(text?.range.end, group?.range.end)).toBe(true);
  });
});

describe("SvgOutlineDocumentSymbolProvider invalid input handling", () => {
  it.each([
    {
      description: "a missing closing tag",
      source: '<svg id="root"><g id="layer">'
    },
    {
      description: "an incomplete opening tag",
      source: '<svg id="root"><rect id="box"'
    },
    {
      description: "an unclosed attribute quote",
      source: '<svg id="root><g/></svg>'
    },
    {
      description: "an empty document",
      source: ""
    }
  ])("returns an empty outline for $description", async ({ source }) => {
    const provider = new SvgOutlineDocumentSymbolProvider(parseSvgOutline);

    await expect(
      provider.provideDocumentSymbols(textDocument(source))
    ).resolves.toEqual([]);
  });

  it("contains parser exceptions and returns an empty outline", async () => {
    const provider = new SvgOutlineDocumentSymbolProvider(() => {
      throw new Error("simulated parser failure");
    });

    await expect(
      provider.provideDocumentSymbols(
        textDocument('<svg id="root"></svg>')
      )
    ).resolves.toEqual([]);
  });
});

function isBeforeOrEqual(
  left: Position | undefined,
  right: Position | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }
  return (
    left.line < right.line ||
    (left.line === right.line && left.character <= right.character)
  );
}
