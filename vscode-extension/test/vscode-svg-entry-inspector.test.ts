import type { FileStat, Uri } from "vscode";
import { FileType } from "vscode";
import { describe, expect, it, vi } from "vitest";

import { VscodeSvgEntryInspector } from "../src/vscodeSvgEntryInspector.js";

function uri(path: string): Uri {
  return { scheme: "file", path } as Uri;
}

function fileStat(type: FileType): FileStat {
  return {
    type,
    ctime: 1,
    mtime: 2,
    size: 3
  };
}

describe("VscodeSvgEntryInspector", () => {
  it("maps a regular file to the file kind", async () => {
    const stat = vi.fn(async () => fileStat(FileType.File));
    const inspector = new VscodeSvgEntryInspector(stat);
    const target = uri("/workspace/example.svg");

    await expect(inspector.inspect(target)).resolves.toBe("file");
    expect(stat).toHaveBeenCalledWith(target);
  });

  it("maps a directory to the directory kind", async () => {
    const inspector = new VscodeSvgEntryInspector(
      async () => fileStat(FileType.Directory)
    );

    await expect(
      inspector.inspect(uri("/workspace/folder.svg"))
    ).resolves.toBe("directory");
  });

  it("maps unknown and special entries to the other kind", async () => {
    const unknown = new VscodeSvgEntryInspector(
      async () => fileStat(FileType.Unknown)
    );
    const symbolicLink = new VscodeSvgEntryInspector(
      async () => fileStat(FileType.SymbolicLink)
    );

    await expect(
      unknown.inspect(uri("/workspace/unknown.svg"))
    ).resolves.toBe("other");
    await expect(
      symbolicLink.inspect(uri("/workspace/link.svg"))
    ).resolves.toBe("other");
  });
});
