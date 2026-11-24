import type {
  ExtensionContext,
  Uri
} from "vscode";
import { FileType, languages, window, workspace } from "vscode";

import { SvgFileDecorationProvider } from "./svgFileDecoration.js";
import { SvgOutlineDocumentSymbolProvider } from "./svgOutlineProvider.js";

export function activate(context: ExtensionContext): void {
  const badgeProvider = new SvgFileDecorationProvider(async (uri: Uri) => {
    const entry = await workspace.fs.stat(uri);
    if ((entry.type & FileType.File) !== 0) {
      return "file";
    }
    if ((entry.type & FileType.Directory) !== 0) {
      return "directory";
    }
    return "other";
  });
  const outlineProvider = new SvgOutlineDocumentSymbolProvider();

  context.subscriptions.push(
    window.registerFileDecorationProvider(badgeProvider),
    languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/*.svg" },
      outlineProvider,
      { label: "SVG Outline" }
    )
  );
}
