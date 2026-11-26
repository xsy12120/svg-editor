import type {
  PluginContributions,
  PluginDiagnostic
} from "../../plugin-api/index.js";

const categories: readonly (keyof PluginContributions)[] = [
  "shapes",
  "commands",
  "decorators",
  "attributes"
];

export class CliPluginDiagnosticFormatter {
  format(diagnostic: PluginDiagnostic): string {
    switch (diagnostic.code) {
      case "not-found":
        return `error: plugin not found: ${diagnostic.module ?? "<unknown>"}`;
      case "no-default-export":
        return `error: plugin has no default export: ${diagnostic.module ?? "<unknown>"}`;
      case "manifest-mismatch":
        return (
          `error: plugin manifest mismatch: ${diagnostic.plugin ?? "<unknown>"} ` +
          `(declared: ${formatContributions(diagnostic.declared)}; ` +
          `registered: ${formatContributions(diagnostic.registered)})`
        );
      case "activation-failed":
        return (
          `error: plugin failed to activate: ${diagnostic.plugin ?? "<unknown>"} ` +
          `(${diagnostic.reason ?? "unknown error"})`
        );
      case "duplicate-registration":
        return (
          `error: duplicate registration: ` +
          `${diagnostic.category ?? "unknown"}/${diagnostic.name ?? "unknown"}`
        );
      case "invalid-config":
        return "error: invalid plugin config";
    }
  }
}

function formatContributions(
  contributions: PluginContributions | undefined
): string {
  if (contributions === undefined) {
    return "";
  }
  return categories
    .filter((category) => (contributions[category]?.length ?? 0) > 0)
    .map(
      (category) =>
        `${category}=[${(contributions[category] ?? []).join(",")}]`
    )
    .join("; ");
}
