import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runCli } from "../support/cli.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const transcriptDirectory = join(projectRoot, "doc", "transcript");

describe("Phase 1 golden baseline", () => {
  it("keeps the documented CLI transcript byte-for-byte stable", async () => {
    const input = await readFile(
      join(transcriptDirectory, "cli-1.txt"),
      "utf8"
    );
    const expectedHash = (
      await readFile(
        join(transcriptDirectory, "cli-1.stdout.sha256"),
        "utf8"
      )
    ).trim();
    const result = await runCli(input);
    const actualHash = createHash("sha256")
      .update(result.stdout)
      .digest("hex");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(actualHash).toBe(expectedHash);
  });
});
