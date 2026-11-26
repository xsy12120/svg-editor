import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runCli } from "../support/cli.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("tree labels CLI integration", () => {
  it("shows box and modified-star labels together", async () => {
    const result = await runCli(
      [
        "init 800 600",
        'create box n1 120 100 160 60 "开始"',
        "tree",
        "set n1 fill #f5a623",
        "set n1 label 处理数据",
        "tree n1"
      ].join("\n"),
      {
        cliArgs: [
          "--config",
          join(projectRoot, "plugins.config.json")
        ]
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("g#n1 (box) *");
    expect(result.stdout).toContain("rect#n1-rect");
    expect(result.stdout).toContain("text#n1-label");
    expect(result.stdout).not.toContain("plugin failed");
  });
});
