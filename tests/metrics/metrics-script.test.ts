import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const scriptPath = join(projectRoot, "scripts", "generate-metrics.mjs");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    )
  );
});

describe("metrics generator", () => {
  it("computes lines and cyclomatic complexity from Git refs", async () => {
    const repository = await createRepository();
    const output = join(repository, "metrics-output");

    const result = runGenerator(repository, output);

    expect(result.status, result.stderr).toBe(0);
    const metrics = JSON.parse(
      await readFile(join(output, "metrics.json"), "utf8")
    ) as MetricsDocument;
    const files = await readFile(join(output, "files.csv"), "utf8");
    const summary = await readFile(join(output, "summary.md"), "utf8");

    expect(metrics.refs).toMatchObject({
      base: "final",
      target: "HEAD",
      targetLabel: "p2"
    });
    expect(byCategory(metrics, "kernel")).toMatchObject({
      baseLines: 6,
      targetLines: 7,
      lineDelta: 1,
      baseComplexity: 2,
      targetComplexity: 3,
      complexityDelta: 1
    });
    expect(byCategory(metrics, "assembly")).toMatchObject({
      baseLines: 1,
      targetLines: 2,
      lineDelta: 1,
      baseComplexity: 1,
      targetComplexity: 2,
      complexityDelta: 1
    });
    expect(byCategory(metrics, "plugin")).toMatchObject({
      baseLines: 1,
      targetLines: 5,
      lineDelta: 4,
      baseComplexity: 1,
      targetComplexity: 3,
      complexityDelta: 2
    });
    expect(metrics.totals.cli).toMatchObject({
      baseLines: 8,
      targetLines: 14,
      lineDelta: 6,
      baseComplexity: 4,
      targetComplexity: 8,
      complexityDelta: 4
    });
    expect(metrics.vscodeExtension).toMatchObject({
      files: 1,
      lines: 3,
      complexity: 1
    });
    expect(files).toContain("kernel,src/application/sample.ts");
    expect(files).toContain("assembly,src/bootstrap/app.ts");
    expect(files).toContain("plugin,src/plugins/new/index.ts");
    expect(files).not.toContain("src/application/sample.test.ts");
    expect(files).not.toContain("node_modules");
    expect(files).not.toContain("dist/");
    expect(summary).toContain("| 内核 | 6 | 7 | +1 | 2 | 3 | +1 |");
    expect(summary).toContain("VSCode 扩展不进入 CLI 增量");
  });

  it("fails clearly when a requested ref does not exist", async () => {
    const repository = await createRepository();
    const output = join(repository, "metrics-output");

    const result = runGenerator(
      repository,
      output,
      "missing-ref"
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Git ref does not exist: missing-ref"
    );
  });
});

interface MetricsDocument {
  readonly refs: {
    readonly base: string;
    readonly target: string;
    readonly targetLabel: string;
  };
  readonly categories: Readonly<
    Record<MetricCategory, MetricTotals>
  >;
  readonly totals: {
    readonly cli: MetricTotals;
  };
  readonly vscodeExtension: {
    readonly files: number;
    readonly lines: number;
    readonly complexity: number;
  };
}

type MetricCategory = "kernel" | "assembly" | "plugin";

interface MetricTotals {
  readonly baseLines: number;
  readonly targetLines: number;
  readonly lineDelta: number;
  readonly baseComplexity: number;
  readonly targetComplexity: number;
  readonly complexityDelta: number;
}

function byCategory(
  metrics: MetricsDocument,
  category: MetricCategory
): MetricTotals {
  return metrics.categories[category];
}

function runGenerator(
  repository: string,
  output: string,
  target = "HEAD"
) {
  return spawnSync(
    process.execPath,
    [
      scriptPath,
      `--repo=${repository}`,
      "--base=final",
      `--target=${target}`,
      "--target-label=p2",
      `--output=${output}`
    ],
    {
      cwd: repository,
      encoding: "utf8"
    }
  );
}

async function createRepository(): Promise<string> {
  const repository = await mkdtemp(
    join(tmpdir(), "svg-metrics-test-")
  );
  temporaryDirectories.push(repository);
  git(repository, ["init"]);
  git(repository, ["config", "user.name", "Metrics Test"]);
  git(repository, ["config", "user.email", "metrics@example.test"]);

  await writeSource(
    repository,
    "src/application/sample.ts",
    [
      "export function choose(value: boolean): number {",
      "  if (value) {",
      "    return 1;",
      "  }",
      "  return 0;",
      "}"
    ].join("\n")
  );
  await writeSource(
    repository,
    "src/bootstrap/app.ts",
    "export const enabled = (): boolean => true;"
  );
  await writeSource(
    repository,
    "src/plugins/legacy/index.ts",
    "export const legacy = true;"
  );
  await writeSource(
    repository,
    "src/application/sample.test.ts",
    "export const excluded = true;"
  );
  await writeSource(
    repository,
    "node_modules/ignored/index.ts",
    "export const ignored = true;"
  );
  await writeSource(
    repository,
    "dist/generated.js",
    "export const ignored = true;"
  );
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "baseline"]);
  git(repository, ["tag", "final"]);

  await writeSource(
    repository,
    "src/application/sample.ts",
    [
      "export function choose(",
      "  value: boolean,",
      "  fallback: boolean",
      "): number {",
      "  if (value) { return 1; }",
      "  return fallback ? 2 : 0;",
      "}"
    ].join("\n")
  );
  await writeSource(
    repository,
    "src/bootstrap/app.ts",
    [
      "export const enabled = (value: boolean): boolean =>",
      "  value && true;"
    ].join("\n")
  );
  await writeSource(
    repository,
    "src/plugins/new/index.ts",
    [
      "export function run(value: boolean): number {",
      "  if (!value) { return 0; }",
      "  return 1;",
      "}"
    ].join("\n")
  );
  await writeSource(
    repository,
    "vscode-extension/src/extension.ts",
    [
      "export function activate(): boolean {",
      "  return true;",
      "}"
    ].join("\n")
  );
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "target"]);
  return repository;
}

async function writeSource(
  repository: string,
  path: string,
  content: string
): Promise<void> {
  const absolutePath = join(repository, path);
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, `${content}\n`, "utf8");
}

function git(repository: string, args: readonly string[]): void {
  execFileSync("git", args, {
    cwd: repository,
    stdio: "pipe"
  });
}
