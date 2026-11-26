export type DirectoryEntryKind =
  | "directory"
  | "file"
  | "symlink"
  | "other";

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: DirectoryEntryKind;
}

export interface DirectoryReader {
  currentDirectory(): string;
  list(path: string): readonly DirectoryEntry[];
}
