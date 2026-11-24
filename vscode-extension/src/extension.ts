import type { ExtensionContext } from "vscode";
import { languages, window } from "vscode";

import { SvgFileDecorationProvider } from "./svgFileDecoration.js";
import { SvgOutlineDocumentSymbolProvider } from "./svgOutlineProvider.js";
import { VscodeSvgEntryInspector } from "./vscodeSvgEntryInspector.js";

export function activate(context: ExtensionContext): void {
  const entryInspector = new VscodeSvgEntryInspector();
  const badgeProvider = new SvgFileDecorationProvider((uri) =>
    entryInspector.inspect(uri)
  );
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
