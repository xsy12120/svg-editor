import type { FileStat, Uri } from "vscode";
import { FileType, workspace } from "vscode";

import type { SvgEntryKind } from "./svgFileDecoration.js";

export type StatFile = (uri: Uri) => PromiseLike<FileStat>;

export class VscodeSvgEntryInspector {
  constructor(
    private readonly statFile: StatFile = (uri) =>
      workspace.fs.stat(uri)
  ) {}

  async inspect(uri: Uri): Promise<SvgEntryKind> {
    const entry = await this.statFile(uri);
    if ((entry.type & FileType.File) !== 0) {
      return "file";
    }
    if ((entry.type & FileType.Directory) !== 0) {
      return "directory";
    }
    return "other";
  }
}
