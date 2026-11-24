import type { DocumentSymbol, Range, TextDocument } from "vscode";
import { DocumentSymbol as VscodeDocumentSymbol, Range as VscodeRange, SymbolKind } from "vscode";

import type { SvgOutlineNode } from "./svgOutlineParser.js";

export interface SvgOutlineSymbolMapping {
  map(document: TextDocument, root: SvgOutlineNode): DocumentSymbol[];
}

export class SvgOutlineSymbolMapper implements SvgOutlineSymbolMapping {
  map(document: TextDocument, root: SvgOutlineNode): DocumentSymbol[] {
    return [this.toDocumentSymbol(document, root)];
  }

  private toDocumentSymbol(
    document: TextDocument,
    node: SvgOutlineNode
  ): DocumentSymbol {
    const symbol = new VscodeDocumentSymbol(
      formatName(node),
      "",
      SymbolKind.Object,
      this.toRange(document, node.range),
      this.toRange(document, node.selectionRange)
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
