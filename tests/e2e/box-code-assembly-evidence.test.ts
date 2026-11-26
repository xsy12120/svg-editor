import { describe, expect, it } from "vitest";

import { runCli } from "../support/cli.js";

describe("box code assembly evidence", () => {
  it("loads box without a plugin configuration file", async () => {
    const result = await runCli(
      [
        "init 800 600",
        'create box n1 120 100 160 60 "开始"',
        "tree"
      ].join("\n")
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "box#n1 created (g#n1 + rect#n1-rect + text#n1-label)"
    );
    expect(result.stdout).toContain("g#n1");
    expect(result.stdout).toContain("rect#n1-rect");
  });
});
