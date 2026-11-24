import type {
  DocumentSymbolProvider,
  Range,
  TextDocument
} from "vscode";
import { DocumentSymbol, Range as VscodeRange, SymbolKind } from "vscode";

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
      const root = this.parse(document.getText());
      return root === null
        ? []
        : [this.toDocumentSymbol(document, root)];
    } catch {
      return [];
    }
  }

  private toDocumentSymbol(
    document: TextDocument,
    node: SvgOutlineNode
  ): DocumentSymbol {
    const range = this.toRange(document, node.range);
    const selectionRange = this.toRange(document, node.selectionRange);
    const symbol = new DocumentSymbol(
      formatName(node),
      "",
      SymbolKind.Object,
      range,
      selectionRange
    );

    if (node.children.length > 0) {
      symbol.children = node.children.map((child) =>
        this.toDocumentSymbol(document, child)
      );
    }
    return symbol;
  }

  private toRange(
    document: TextDocument,
    range: {
      readonly start: number;
      readonly end: number;
    }
  ): Range {
    return new VscodeRange(
      document.positionAt(range.start),
      document.positionAt(range.end)
    );
  }
}

function formatName(node: SvgOutlineNode): string {
  return node.id === undefined ? node.tagName : `${node.tagName}#${node.id}`;
}
