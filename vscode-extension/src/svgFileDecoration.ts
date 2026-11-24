import type {
  FileDecoration,
  FileDecorationProvider,
  Uri
} from "vscode";

export type SvgEntryKind = "file" | "directory" | "other";

export type InspectSvgEntry = (uri: Uri) => Promise<SvgEntryKind>;

export function classifySvgFile(
  uri: Pick<Uri, "scheme" | "path">,
  kind: SvgEntryKind
): boolean {
  return (
    kind === "file" &&
    uri.scheme === "file" &&
    uri.path.toLowerCase().endsWith(".svg")
  );
}

export class SvgFileDecorationProvider
  implements FileDecorationProvider
{
  constructor(private readonly inspectEntry: InspectSvgEntry) {}

  async provideFileDecoration(
    uri: Uri
  ): Promise<FileDecoration | undefined> {
    if (!hasSvgPath(uri)) {
      return undefined;
    }

    const kind = await this.inspectEntry(uri);
    if (!classifySvgFile(uri, kind)) {
      return undefined;
    }

    return { badge: "[]" };
  }
}

function hasSvgPath(uri: Pick<Uri, "scheme" | "path">): boolean {
  return (
    uri.scheme === "file" &&
    uri.path.toLowerCase().endsWith(".svg")
  );
}
