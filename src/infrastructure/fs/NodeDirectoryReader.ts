import { readdirSync } from "node:fs";

import type {
  DirectoryEntry,
  DirectoryEntryKind,
  DirectoryReader
} from "../../application/ports/DirectoryReader.js";

export class NodeDirectoryReader implements DirectoryReader {
  constructor(
    private readonly cwd: () => string = () => process.cwd()
  ) {}

  currentDirectory(): string {
    return this.cwd();
  }

  list(path: string): readonly DirectoryEntry[] {
    return readdirSync(path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      kind: kindOf(entry)
    }));
  }
}

function kindOf(entry: {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}): DirectoryEntryKind {
  if (entry.isSymbolicLink()) {
    return "symlink";
  }
  if (entry.isDirectory()) {
    return "directory";
  }
  if (entry.isFile()) {
    return "file";
  }
  return "other";
}
