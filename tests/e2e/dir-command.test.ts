import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runCli } from "../support/cli.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "svg-cli-dir-"));
  await mkdir(join(directory, "docs"));
  await writeFile(join(directory, "demo.svg"), "<svg/>");
  await writeFile(join(directory, ".env"), "");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("dir CLI integration", () => {
  it("reports dir as unknown when the plugin is not loaded", async () => {
    const result = await runCli("dir\n", { cwd: directory });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("error: unknown command: dir");
  });

  it("lists the process directory through the real filesystem adapter", async () => {
    const result = await runCli("dir\n", {
      cwd: directory,
      cliArgs: [
        "--config",
        join(projectRoot, "tests", "fixtures", "configs", "dir.json")
      ]
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      [
        "[DIR]  docs",
        "[FILE]  .env",
        "[FILE]  demo.svg"
      ].join("\n")
    );
    expect(result.stdout).not.toContain("error:");
  });

  it("keeps listing the launch directory after read and save", async () => {
    await writeFile(
      join(directory, "source.svg"),
      '<svg width="100" height="100"></svg>'
    );
    const result = await runCli(
      ["read source.svg", "save saved.svg", "dir"].join("\n"),
      {
        cwd: directory,
        cliArgs: [
          "--config",
          join(
            projectRoot,
            "tests",
            "fixtures",
            "configs",
            "dir.json"
          )
        ]
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("read source.svg (0 elements)");
    expect(result.stdout).toContain("saved to saved.svg (0 elements)");
    expect(result.stdout).toContain(
      [
        "[DIR]  docs",
        "[FILE]  .env",
        "[FILE]  demo.svg",
        "[FILE]  saved.svg",
        "[FILE]  source.svg"
      ].join("\n")
    );
  });
});
