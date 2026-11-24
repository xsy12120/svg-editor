import type { TextDocument } from "vscode";
import { describe, expect, it } from "vitest";

import { parseSvgOutline } from "../src/svgOutlineParser.js";
import { SvgOutlineDocumentSymbolProvider } from "../src/svgOutlineProvider.js";

function textDocument(source: string): TextDocument {
  return {
    getText(): string {
      return source;
    },
    positionAt(): never {
      throw new Error("positionAt must not be called for an empty outline");
    }
  } as unknown as TextDocument;
}

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
