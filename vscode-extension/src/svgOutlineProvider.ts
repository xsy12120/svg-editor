import type {
  DocumentSymbol,
  DocumentSymbolProvider,
  TextDocument
} from "vscode";

import {
  parseSvgOutline,
  type SvgOutlineNode
} from "./svgOutlineParser.js";

export type SvgOutlineParser = (
  source: string
) => SvgOutlineNode | null;

export class SvgOutlineDocumentSymbolProvider
  implements DocumentSymbolProvider
{
  constructor(
    private readonly parse: SvgOutlineParser = parseSvgOutline
  ) {}

  async provideDocumentSymbols(
    document: TextDocument
  ): Promise<DocumentSymbol[]> {
    try {
      this.parse(document.getText());
      return [];
    } catch {
      return [];
    }
  }
}
