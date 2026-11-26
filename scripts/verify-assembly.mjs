import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  access,
  readFile,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { codePlugins } from "./code-plugins.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const transcriptDirectory = join(projectRoot, "doc", "transcript");
const fixtureDirectory = join(
  projectRoot,
  "tests",
  "fixtures",
  "assembly-workdir"
);
const configPath = join(
  projectRoot,
  "tests",
  "fixtures",
  "configs",
  "dual-assembly.json"
);
const compatibilityConfigPath = join(
  projectRoot,
  "tests",
  "fixtures",
  "configs",
  "phase1-compatible.json"
);
const transcriptNames = [
  "cli-2-dual-base",
  "cli-2-dual-box",
  "cli-2-dual-extensions"
];
const writeExpected = process.argv.includes("--write");

await requireFile(join(projectRoot, "dist", "main.js"));
await requireFile(configPath);
await requireFile(compatibilityConfigPath);
await verifyPluginSet(configPath, codePlugins);

for (const name of transcriptNames) {
  const input = await readRequired(
    join(transcriptDirectory, `${name}.txt`)
  );
  const code = run(
    [join(projectRoot, "scripts", "run-code-assembly.mjs")],
    input
  );
  const config = run(
    [
      join(projectRoot, "dist", "main.js"),
      "--config",
      configPath
    ],
    input
  );

  assertSuccessful(code, `${name} code assembly`);
  assertSuccessful(config, `${name} config assembly`);
  if (code.stdout !== config.stdout) {
    throw new Error(
      `${name}: code and config assembly stdout differ`
    );
  }

  const expectedPath = join(
    transcriptDirectory,
    `${name}.stdout`
  );
  if (writeExpected) {
    await writeFile(expectedPath, code.stdout, "utf8");
  } else {
    const expected = await readRequired(expectedPath);
    if (code.stdout !== expected) {
      throw new Error(`${name}: stdout differs from ${expectedPath}`);
    }
  }
}

const phase1Input = await readRequired(
  join(transcriptDirectory, "cli-1.txt")
);
const baseline = run([join(projectRoot, "dist", "main.js")], phase1Input);
const compatible = run(
  [
    join(projectRoot, "dist", "main.js"),
    "--config",
    compatibilityConfigPath
  ],
  phase1Input
);
assertSuccessful(baseline, "Phase 1 baseline");
assertSuccessful(compatible, "Phase 1 compatibility config");
if (baseline.stdout !== compatible.stdout) {
  throw new Error(
    "disabling optional plugins changed Phase 1 baseline stdout"
  );
}

const finalHash = (
  await readRequired(
    join(transcriptDirectory, "cli-1.stdout.sha256")
  )
).trim();
const compatibleHash = createHash("sha256")
  .update(compatible.stdout)
  .digest("hex");
if (compatibleHash !== finalHash) {
  throw new Error(
    `Phase 1 compatibility hash ${compatibleHash} != final ${finalHash}`
  );
}

const finalOutputPath = join(
  transcriptDirectory,
  "cli-1-final.stdout"
);
if (writeExpected) {
  await writeFile(finalOutputPath, compatible.stdout, "utf8");
} else {
  const finalOutput = await readRequired(finalOutputPath);
  if (compatible.stdout !== finalOutput) {
    throw new Error(
      `Phase 1 compatibility output differs from ${finalOutputPath}`
    );
  }
}

process.stdout.write(
  writeExpected
    ? "dual assembly: expected outputs updated\n"
    : "dual assembly: all checks passed\n"
);

function run(args, input) {
  const result = spawnSync(process.execPath, args, {
    cwd: fixtureDirectory,
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1"
    }
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function assertSuccessful(result, label) {
  if (result.exitCode !== 0 || result.stderr !== "") {
    throw new Error(
      `${label} failed (exit ${result.exitCode})\n${result.stderr}`
    );
  }
}

async function verifyPluginSet(path, activations) {
  const parsed = JSON.parse(await readRequired(path));
  if (!Array.isArray(parsed.plugins)) {
    throw new Error(`${path}: plugins must be an array`);
  }
  const enabled = parsed.plugins.filter(
    (entry) => entry.enabled !== false
  );
  if (enabled.length !== activations.length) {
    throw new Error(
      `${path}: expected ${activations.length} enabled plugins, found ${enabled.length}`
    );
  }

  for (const [index, activation] of activations.entries()) {
    const entry = enabled[index];
    const modulePath = resolve(dirname(path), entry.module);
    const packageJson = JSON.parse(
      await readRequired(join(modulePath, "package.json"))
    );
    if (packageJson.name !== activation.manifest.name) {
      throw new Error(
        `plugin ${index}: ${packageJson.name} != ${activation.manifest.name}`
      );
    }
    if (
      JSON.stringify(packageJson.contributes ?? {}) !==
      JSON.stringify(activation.manifest.contributes)
    ) {
      throw new Error(
        `plugin ${index}: contributes declarations differ`
      );
    }
    if (
      JSON.stringify(entry.options ?? null) !==
      JSON.stringify(activation.options ?? null)
    ) {
      throw new Error(`plugin ${index}: options differ`);
    }
  }
}

async function readRequired(path) {
  await requireFile(path);
  return readFile(path, "utf8");
}

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`required acceptance path does not exist: ${path}`);
  }
}
