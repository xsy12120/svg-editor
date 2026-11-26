import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const cliCategories = ["kernel", "assembly", "plugin"];
const categoryLabels = {
  kernel: "内核",
  assembly: "装配处",
  plugin: "插件"
};

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
  } else {
    await generate(options);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}

async function generate(options) {
  const repository = gitOutput(options.repo, [
    "rev-parse",
    "--show-toplevel"
  ]).trim();
  const base = resolveSnapshot(repository, options.base);
  const target = resolveSnapshot(repository, options.target);
  const report = buildReport(
    base,
    target,
    options.targetLabel
  );
  const outputDirectory = resolve(repository, options.output);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      join(outputDirectory, "metrics.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      join(outputDirectory, "files.csv"),
      renderFilesCsv(report.files),
      "utf8"
    ),
    writeFile(
      join(outputDirectory, "summary.md"),
      renderSummary(report),
      "utf8"
    )
  ]);
  process.stdout.write(
    `metrics written to ${outputDirectory}\n`
  );
}

function parseArguments(args) {
  const options = {
    repo: process.cwd(),
    base: "final",
    target: "HEAD",
    targetLabel: "p2",
    output: "docs/metrics",
    help: false
  };

  for (const argument of args) {
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    const separator = argument.indexOf("=");
    if (separator < 0) {
      throw new Error(`invalid argument: ${argument}\n${usage()}`);
    }
    const name = argument.slice(0, separator);
    const value = argument.slice(separator + 1);
    if (value.length === 0) {
      throw new Error(`missing value for ${name}`);
    }
    switch (name) {
      case "--repo":
        options.repo = value;
        break;
      case "--base":
        options.base = value;
        break;
      case "--target":
        options.target = value;
        break;
      case "--target-label":
        options.targetLabel = value;
        break;
      case "--output":
        options.output = value;
        break;
      default:
        throw new Error(`unknown argument: ${name}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/generate-metrics.mjs [options]",
    "",
    "Options:",
    "  --repo=<path>           Git repository (default: current directory)",
    "  --base=<ref>            Baseline ref (default: final)",
    "  --target=<ref>          Target ref (default: HEAD)",
    "  --target-label=<label>  Target heading (default: p2)",
    "  --output=<path>         Output directory (default: docs/metrics)",
    "  --help                  Show this help",
    ""
  ].join("\n");
}

function resolveSnapshot(repository, ref) {
  let commit;
  try {
    commit = gitOutput(repository, [
      "rev-parse",
      "--verify",
      `${ref}^{commit}`
    ]).trim();
  } catch {
    throw new Error(`Git ref does not exist: ${ref}`);
  }
  const committedAt = gitOutput(repository, [
    "show",
    "-s",
    "--format=%cI",
    commit
  ]).trim();
  const tree = gitBuffer(repository, [
    "ls-tree",
    "-r",
    "--full-tree",
    "-z",
    commit
  ]);
  const entries = parseTreeEntries(tree);
  const selected = entries.filter(
    (entry) =>
      entry.type === "blob" && sourceScope(entry.path) !== null
  );
  const blobs = readBlobs(
    repository,
    [...new Set(selected.map((entry) => entry.objectId))]
  );
  const files = [];
  for (const { path, objectId } of selected) {
    const scope = sourceScope(path);
    const source = blobs.get(objectId)?.toString("utf8") ?? "";
    files.push({
      path,
      scope,
      category:
        scope === "cli" ? categoryFor(path) : "vscode-extension",
      responsibility: responsibilityFor(path, scope),
      lines: countNonEmptyLines(source),
      complexity: calculateFileComplexity(path, source),
      sourceHash: createHash("sha256")
        .update(source)
        .digest("hex")
    });
  }
  files.sort((left, right) => compare(left.path, right.path));
  return { ref, commit, committedAt, files };
}

function parseTreeEntries(buffer) {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter((record) => record.length > 0)
    .map((record) => {
      const tab = record.indexOf("\t");
      if (tab < 0) {
        throw new Error("invalid git ls-tree record");
      }
      const [mode, type, objectId] = record
        .slice(0, tab)
        .split(/\s+/);
      if (
        mode === undefined ||
        type === undefined ||
        objectId === undefined
      ) {
        throw new Error("invalid git ls-tree metadata");
      }
      return {
        mode,
        type,
        objectId,
        path: record.slice(tab + 1)
      };
    });
}

function readBlobs(repository, objectIds) {
  const blobs = new Map();
  if (objectIds.length === 0) {
    return blobs;
  }
  const output = execFileSync("git", ["cat-file", "--batch"], {
    cwd: repository,
    input: `${objectIds.join("\n")}\n`,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let offset = 0;
  while (offset < output.length) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0) {
      throw new Error("invalid git cat-file header");
    }
    const header = output
      .subarray(offset, headerEnd)
      .toString("utf8");
    const match = /^([0-9a-f]+) (\w+) (\d+)$/.exec(header);
    if (match === null) {
      throw new Error(`invalid git cat-file record: ${header}`);
    }
    const objectId = match[1];
    const size = Number(match[3]);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    blobs.set(
      objectId,
      output.subarray(contentStart, contentEnd)
    );
    offset = contentEnd + 1;
  }
  return blobs;
}

function sourceScope(path) {
  if (
    path.startsWith("src/") &&
    /\.(?:cts|mts|ts|tsx)$/.test(path) &&
    !/\.(?:test|spec)\.(?:cts|mts|ts|tsx)$/.test(path)
  ) {
    return "cli";
  }
  if (
    path.startsWith("vscode-extension/src/") &&
    /\.(?:cts|mts|ts|tsx)$/.test(path) &&
    !/\.(?:test|spec)\.(?:cts|mts|ts|tsx)$/.test(path)
  ) {
    return "vscode-extension";
  }
  return null;
}

function categoryFor(path) {
  if (path.startsWith("src/plugins/")) {
    return "plugin";
  }
  if (
    path === "src/main.ts" ||
    path.startsWith("src/bootstrap/") ||
    path.startsWith("src/host/")
  ) {
    return "assembly";
  }
  return "kernel";
}

function responsibilityFor(path, scope) {
  if (scope === "vscode-extension") {
    return "VSCode 扩展（单独统计）";
  }
  const rules = [
    ["src/application/commands/", "应用命令"],
    ["src/application/context/", "编辑上下文"],
    ["src/application/extensions/", "扩展点接口与注册表"],
    ["src/application/history/", "撤销与重做"],
    ["src/application/ports/", "应用端口"],
    ["src/application/queries/", "查询快照"],
    ["src/application/shapes/", "图形工厂与目录"],
    ["src/application/", "应用服务"],
    ["src/domain/", "领域模型"],
    ["src/infrastructure/fs/", "文件系统适配器"],
    ["src/infrastructure/svg/", "SVG 编解码与解析"],
    ["src/interfaces/cli/", "CLI 接口与呈现"],
    ["src/plugin-api/", "插件公开接口"],
    ["src/shared/", "共享错误"],
    ["src/bootstrap/", "组合根与装配"],
    ["src/host/", "插件宿主与加载"],
    ["src/plugins/", "插件实现"],
    ["src/main.ts", "CLI 启动"]
  ];
  return (
    rules.find(([prefix]) => path.startsWith(prefix))?.[1] ??
    "CLI 源码"
  );
}

function countNonEmptyLines(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
}

function calculateFileComplexity(path, source) {
  const tokens = tokenize(source);
  const decisions = tokens.reduce(
    (total, token, index) => {
      if (
        token === "if" ||
        token === "for" ||
        token === "do" ||
        token === "while" ||
        token === "catch" ||
        token === "case" ||
        token === "&&" ||
        token === "||" ||
        token === "??"
      ) {
        return total + 1;
      }
      if (
        token === "?" &&
        tokens[index + 1] !== "?" &&
        tokens[index + 1] !== "." &&
        tokens[index + 1] !== ":"
      ) {
        return total + 1;
      }
      return total;
    },
    0
  );
  return 1 + decisions;
}

function buildReport(base, target, targetLabel) {
  const baseFiles = new Map(
    base.files.map((file) => [file.path, file])
  );
  const targetFiles = new Map(
    target.files.map((file) => [file.path, file])
  );
  const paths = [
    ...new Set([...baseFiles.keys(), ...targetFiles.keys()])
  ].sort(compare);
  const files = paths.map((path) => {
    const before = baseFiles.get(path);
    const after = targetFiles.get(path);
    const reference = after ?? before;
    return {
      path,
      scope: reference.scope,
      category: reference.category,
      responsibility: reference.responsibility,
      status:
        before === undefined
          ? "added"
          : after === undefined
            ? "removed"
            : before.sourceHash === after.sourceHash
              ? "unchanged"
              : "changed",
      baseLines: before?.lines ?? 0,
      targetLines: after?.lines ?? 0,
      lineDelta: (after?.lines ?? 0) - (before?.lines ?? 0),
      baseComplexity: before?.complexity ?? 0,
      targetComplexity: after?.complexity ?? 0,
      complexityDelta:
        (after?.complexity ?? 0) - (before?.complexity ?? 0),
      sourceHash: after?.sourceHash ?? before?.sourceHash ?? ""
    };
  });

  const categories = Object.fromEntries(
    cliCategories.map((category) => {
      const categoryFiles = files.filter(
        (file) => file.category === category
      );
      return [
        category,
        summarize(categoryFiles, base.files, target.files)
      ];
    })
  );
  const cliBase = base.files.filter((file) => file.scope === "cli");
  const cliTarget = target.files.filter(
    (file) => file.scope === "cli"
  );
  const vscodeFiles = target.files.filter(
    (file) => file.scope === "vscode-extension"
  );
  return {
    generator: "scripts/generate-metrics.mjs",
    refs: {
      base: base.ref,
      baseCommit: base.commit,
      baseCommittedAt: base.committedAt,
      target: target.ref,
      targetCommit: target.commit,
      targetCommittedAt: target.committedAt,
      targetLabel
    },
    algorithm: {
      source: "Git tracked TypeScript source files",
      cliScope:
        "src/**/*.{ts,tsx,cts,mts} (excluding test and spec files)",
      vscodeScope:
        "vscode-extension/src/**/*.{ts,tsx,cts,mts} (excluding test and spec files)",
      lines: "non-empty physical lines",
      complexity:
        "file-level cyclomatic complexity: base 1 plus if, loops, catch, case, conditional expression, &&, || and ??; comments and string-like literals are ignored",
      excluded:
        "tests, docs, dependencies and build output are excluded; VSCode extension is excluded from CLI aggregates"
    },
    categories,
    totals: {
      cli: summarize(files.filter((file) => file.scope === "cli"), base.files, target.files)
    },
    vscodeExtension: {
      files: vscodeFiles.length,
      lines: vscodeFiles.reduce(
        (total, file) => total + file.lines,
        0
      ),
      complexity: vscodeFiles.reduce(
        (total, file) => total + file.complexity,
        0
      ),
      note: "VSCode extension is reported separately and is not included in CLI deltas"
    },
    files
  };
}

function summarize(files, baseFiles, targetFiles) {
  const paths = new Set(files.map((file) => file.path));
  const baseLines = baseFiles
    .filter((file) => paths.has(file.path))
    .reduce((total, file) => total + file.lines, 0);
  const targetLines = targetFiles
    .filter((file) => paths.has(file.path))
    .reduce((total, file) => total + file.lines, 0);
  const baseComplexity = baseFiles
    .filter((file) => paths.has(file.path))
    .reduce((total, file) => total + file.complexity, 0);
  const targetComplexity = targetFiles
    .filter((file) => paths.has(file.path))
    .reduce((total, file) => total + file.complexity, 0);
  return {
    files: files.length,
    baseLines,
    targetLines,
    lineDelta: targetLines - baseLines,
    baseComplexity,
    targetComplexity,
    complexityDelta: targetComplexity - baseComplexity
  };
}

function renderFilesCsv(files) {
  const header = [
    "category",
    "path",
    "responsibility",
    "baseLines",
    "targetLines",
    "lineDelta",
    "baseComplexity",
    "targetComplexity",
    "complexityDelta",
    "status"
  ];
  return `${[
    header.join(","),
    ...files.map((file) =>
      [
        file.category,
        file.path,
        file.responsibility,
        file.baseLines,
        file.targetLines,
        file.lineDelta,
        file.baseComplexity,
        file.targetComplexity,
        file.complexityDelta,
        file.status
      ]
        .map(csvCell)
        .join(",")
    )
  ].join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function renderSummary(report) {
  const tables = cliCategories.map((category) => {
    const value = report.categories[category];
    return `| ${categoryLabels[category]} | ${value.baseLines} | ${value.targetLines} | ${signed(value.lineDelta)} | ${value.baseComplexity} | ${value.targetComplexity} | ${signed(value.complexityDelta)} | ${value.files} |`;
  });
  const total = report.totals.cli;
  const extension = report.vscodeExtension;
  return [
    "# CLI 与 VSCode 指标",
    "",
    `基线：\`${report.refs.base}\` (${report.refs.baseCommit})`,
    "",
    `目标：\`${report.refs.target}\` (${report.refs.targetCommit})，标记为 \`${report.refs.targetLabel}\``,
    "",
    "## CLI 指标",
    "",
    "| 分类 | 基线行数 | 目标行数 | 行数增量 | 基线圈复杂度 | 目标圈复杂度 | 复杂度增量 | 文件数 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...tables,
    `| 合计 | ${total.baseLines} | ${total.targetLines} | ${signed(total.lineDelta)} | ${total.baseComplexity} | ${total.targetComplexity} | ${signed(total.complexityDelta)} | ${total.files} |`,
    "",
    "## VSCode 扩展",
    "",
    `VSCode 扩展不进入 CLI 增量：${extension.files} 个文件，${extension.lines} 行，圈复杂度 ${extension.complexity}。`,
    "",
    "## 口径",
    "",
    "- 数据只来自 Git ref 中跟踪的文件，不读取工作区未提交内容。",
    "- 行数指非空物理行。",
    "- 圈复杂度按文件统计：每个文件基数为 1，并计入 `if`、循环、`catch`、`case`、三元表达式、`&&`、`||` 和 `??`；注释及字符串字面量不参与统计。",
    "- 测试、文档、依赖、构建产物和 VSCode 扩展不计入 CLI 三类指标。",
    "- 文件级职责、基线与目标数值见 `files.csv`，完整原始数据见 `metrics.json`。",
    ""
  ].join("\n");
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function gitOutput(repository, args) {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function gitBuffer(repository, args) {
  return execFileSync("git", args, {
    cwd: repository,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }
    if (
      character === "'" ||
      character === '"' ||
      character === "`"
    ) {
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === character) {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    if (/[A-Za-z_$]/.test(character)) {
      const start = index;
      index += 1;
      while (
        index < source.length &&
        /[A-Za-z0-9_$]/.test(source[index])
      ) {
        index += 1;
      }
      tokens.push(source.slice(start, index));
      continue;
    }
    const pair = source.slice(index, index + 2);
    if (
      pair === "&&" ||
      pair === "||" ||
      pair === "??" ||
      pair === "?."
    ) {
      tokens.push(pair);
      index += 2;
      continue;
    }
    tokens.push(character);
    index += 1;
  }
  return tokens;
}
