import type {
  DocumentSymbol,
  DocumentSymbolProvider,
  TextDocument
} from "vscode";

import {
  parseSvgOutline,
  type SvgOutlineNode
} from "./svgOutlineParser.js";
import {
  SvgOutlineSymbolMapper,
  type SvgOutlineSymbolMapping
} from "./svgOutlineSymbolMapper.js";

export type SvgOutlineParser = (
  source: string
) => SvgOutlineNode | null;

export class SvgOutlineDocumentSymbolProvider
  implements DocumentSymbolProvider
{
  constructor(
    private readonly parse: SvgOutlineParser = parseSvgOutline,
    private readonly mapper: SvgOutlineSymbolMapping =
      new SvgOutlineSymbolMapper()
  ) {}

  async provideDocumentSymbols(
    document: TextDocument
  ): Promise<DocumentSymbol[]> {
    try {
      const root = this.parse(document.getText());
      return root === null
        ? []
        : this.mapper.map(document, root);
    } catch {
      return [];
    }
  }
}
