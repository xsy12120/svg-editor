import type {
  DocumentSymbolProvider,
  ExtensionContext,
  FileDecorationProvider
} from "vscode";
import { languages, window } from "vscode";

const badgeProvider: FileDecorationProvider = {
  provideFileDecoration(): undefined {
    return undefined;
  }
};

const outlineProvider: DocumentSymbolProvider = {
  provideDocumentSymbols(): [] {
    return [];
  }
};

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(
    window.registerFileDecorationProvider(badgeProvider),
    languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/*.svg" },
      outlineProvider,
      { label: "SVG Outline" }
    )
  );
}
