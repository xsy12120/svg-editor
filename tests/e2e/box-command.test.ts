import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runCli } from "../support/cli.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("box CLI integration", () => {
  it("runs box creation, mutation, tree output and undo through config", async () => {
    const result = await runCli(
      [
        "init 800 600",
        'create box n1 120 100 160 60 "开始"',
        "tree",
        "set n1 fill #f5a623",
        'set n1 label "处理数据 v2"',
        "undo",
        "redo",
        "tree n1"
      ].join("\n"),
      {
        cliArgs: [
          "--config",
          join(projectRoot, "tests", "fixtures", "configs", "box.json")
        ]
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "box#n1 created (g#n1 + rect#n1-rect + text#n1-label)"
    );
    expect(result.stdout).toContain("g#n1 (box)");
    expect(result.stdout).toContain(
      "box#n1 fill propagated to n1-rect"
    );
    expect(result.stdout).toContain(
      'box#n1 label updated: "处理数据 v2"'
    );
    expect(result.stdout).toContain(
      'box#n1 label restored: "开始"'
    );
    expect(result.stdout).toContain(
      'box#n1 label updated: "处理数据 v2"'
    );
  });
});
