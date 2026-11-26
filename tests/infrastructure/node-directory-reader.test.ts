import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeDirectoryReader } from "../../src/infrastructure/fs/NodeDirectoryReader.js";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "svg-dir-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("NodeDirectoryReader", () => {
  it("reads direct files and directories including hidden entries", async () => {
    await mkdir(join(directory, "nested"));
    await writeFile(join(directory, "demo.svg"), "<svg/>");
    await writeFile(join(directory, ".hidden"), "");
    const reader = new NodeDirectoryReader(() => directory);

    expect(reader.currentDirectory()).toBe(directory);
    expect(
      reader
        .list(directory)
        .map((entry) => [entry.name, entry.kind])
        .sort()
    ).toEqual([
      [".hidden", "file"],
      ["demo.svg", "file"],
      ["nested", "directory"]
    ]);
  });
});
