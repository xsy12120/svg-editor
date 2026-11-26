import type {
  CommandResult,
  DirectoryEntry,
  DirectoryReader,
  EditorCommandContext,
  QueryCommand
} from "../../plugin-api/index.js";

const kindOrder: Readonly<Record<DirectoryEntry["kind"], number>> = {
  directory: 0,
  file: 1,
  symlink: 2,
  other: 3
};

const kindLabels: Readonly<Record<DirectoryEntry["kind"], string>> = {
  directory: "[DIR]",
  file: "[FILE]",
  symlink: "[LINK]",
  other: "[OTHER]"
};

export class DirCommand implements QueryCommand<EditorCommandContext> {
  readonly kind = "query";

  constructor(private readonly directories: DirectoryReader) {}

  validate(): void {}

  execute(): CommandResult {
    let path = "";
    try {
      path = this.directories.currentDirectory();
      const entries = [...this.directories.list(path)].sort(compareEntries);
      return {
        success: true,
        message:
          entries.length === 0
            ? "(empty directory)"
            : entries
                .map(
                  (entry) =>
                    `${kindLabels[entry.kind]}  ${entry.name}`
                )
                .join("\n"),
        affectedIds: []
      };
    } catch {
      return {
        success: false,
        message: `cannot read directory: ${path}`,
        affectedIds: []
      };
    }
  }
}

function compareEntries(
  left: DirectoryEntry,
  right: DirectoryEntry
): number {
  return (
    kindOrder[left.kind] - kindOrder[right.kind] ||
    compareNames(left.name, right.name)
  );
}

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
