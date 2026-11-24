import type {
  FileDecoration,
  FileDecorationProvider,
  Uri
} from "vscode";

export type SvgEntryKind = "file" | "directory" | "other";

export type InspectSvgEntry = (uri: Uri) => Promise<SvgEntryKind>;

export function isSvgUri(
  uri: Pick<Uri, "scheme" | "path">
): boolean {
  return (
    uri.scheme === "file" &&
    uri.path.toLowerCase().endsWith(".svg")
  );
}

export function classifySvgFile(
  uri: Pick<Uri, "scheme" | "path">,
  kind: SvgEntryKind
): boolean {
  return kind === "file" && isSvgUri(uri);
}

export class SvgFileDecorationProvider
  implements FileDecorationProvider
{
  constructor(private readonly inspectEntry: InspectSvgEntry) {}

  async provideFileDecoration(
    uri: Uri
  ): Promise<FileDecoration | undefined> {
    if (!isSvgUri(uri)) {
      return undefined;
    }

    const kind = await this.inspectEntry(uri);
    if (kind !== "file") {
      return undefined;
    }

    return { badge: "[]" };
  }
}
