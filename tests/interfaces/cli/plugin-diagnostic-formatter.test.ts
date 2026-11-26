import { describe, expect, it } from "vitest";

import { CliPluginDiagnosticFormatter } from "../../../src/interfaces/cli/CliPluginDiagnosticFormatter.js";

describe("CliPluginDiagnosticFormatter", () => {
  const formatter = new CliPluginDiagnosticFormatter();

  it.each([
    {
      diagnostic: {
        code: "not-found" as const,
        module: "@svgframe/missing"
      },
      expected: "error: plugin not found: @svgframe/missing"
    },
    {
      diagnostic: {
        code: "no-default-export" as const,
        module: "./plugin.js"
      },
      expected: "error: plugin has no default export: ./plugin.js"
    },
    {
      diagnostic: {
        code: "manifest-mismatch" as const,
        plugin: "@svgframe/mismatch",
        declared: { commands: ["declared"] },
        registered: { commands: ["actual"] }
      },
      expected:
        "error: plugin manifest mismatch: @svgframe/mismatch " +
        "(declared: commands=[declared]; registered: commands=[actual])"
    },
    {
      diagnostic: {
        code: "activation-failed" as const,
        plugin: "@svgframe/failure",
        reason: "boom"
      },
      expected:
        "error: plugin failed to activate: @svgframe/failure (boom)"
    },
    {
      diagnostic: {
        code: "duplicate-registration" as const,
        category: "commands" as const,
        name: "stats"
      },
      expected: "error: duplicate registration: commands/stats"
    },
    {
      diagnostic: {
        code: "invalid-config" as const
      },
      expected: "error: invalid plugin config"
    }
  ])("formats $diagnostic.code", ({ diagnostic, expected }) => {
    expect(formatter.format(diagnostic)).toBe(expected);
  });
});
