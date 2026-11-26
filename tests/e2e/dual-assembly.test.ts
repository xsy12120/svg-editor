import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createCliApplication,
  type CodePluginActivation,
  type CreateCliApplicationOptions
} from "../../src/bootstrap/CompositionRoot.js";
import {
  dirPlugin,
  dirPluginManifest
} from "../../src/plugins/command-dir/index.js";
import {
  statsPlugin,
  statsPluginManifest
} from "../../src/plugins/command-stats/index.js";
import {
  boxPlugin,
  boxPluginManifest
} from "../../src/plugins/shape-box/index.js";
import {
  boxTypeLabelManifest,
  boxTypeLabelPlugin
} from "../../src/plugins/tree-box-label/index.js";
import {
  modifiedStarManifest,
  modifiedStarPlugin
} from "../../src/plugins/tree-star/index.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
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

const codePlugins: readonly CodePluginActivation[] = [
  { plugin: statsPlugin, manifest: statsPluginManifest },
  { plugin: dirPlugin, manifest: dirPluginManifest },
  { plugin: boxPlugin, manifest: boxPluginManifest },
  {
    plugin: boxTypeLabelPlugin,
    manifest: boxTypeLabelManifest
  },
  {
    plugin: modifiedStarPlugin,
    manifest: modifiedStarManifest
  }
];

const originalDirectory = process.cwd();

beforeAll(() => {
  process.chdir(fixtureDirectory);
});

afterAll(() => {
  process.chdir(originalDirectory);
});

interface ApplicationResult {
  readonly exitCode: number;
  readonly stdout: string;
}

async function runInMemory(
  input: string,
  options: CreateCliApplicationOptions
): Promise<ApplicationResult> {
  let stdout = "";
  const output = new Writable({
    write(chunk: Buffer | string, _encoding, callback): void {
      stdout += chunk.toString();
      callback();
    }
  });
  const application = await createCliApplication(
    Readable.from([input]),
    output,
    options
  );
  const exitCode = await application.run();
  return { exitCode, stdout };
}

async function readTranscript(name: string): Promise<string> {
  return readFile(join(transcriptDirectory, name), "utf8");
}

async function readExpected(name: string): Promise<string> {
  return readFile(join(transcriptDirectory, `${name}.stdout`), "utf8");
}

describe("dual plugin assembly", () => {
  it.each([
    "cli-2-dual-base",
    "cli-2-dual-box",
    "cli-2-dual-extensions"
  ])("produces byte-identical output for %s", async (name) => {
    const input = await readTranscript(`${name}.txt`);
    const expected = await readExpected(name);

    const fromCode = await runInMemory(input, {
      codePlugins
    });
    const fromConfig = await runInMemory(input, {
      configPath
    });

    expect(fromCode.exitCode).toBe(0);
    expect(fromConfig.exitCode).toBe(0);
    expect(fromCode.stdout).toBe(expected);
    expect(fromConfig.stdout).toBe(expected);
  });

  it("keeps disabled optional plugins byte-compatible with final", async () => {
    const input = await readTranscript("cli-2-dual-base.txt");
    const expectedHash = (
      await readFile(
        join(transcriptDirectory, "cli-1.stdout.sha256"),
        "utf8"
      )
    ).trim();
    const finalOutput = await readFile(
      join(transcriptDirectory, "cli-1-final.stdout"),
      "utf8"
    );

    const baseline = await runInMemory(
      await readTranscript("cli-1.txt"),
      {}
    );
    const compatibleConfig = await runInMemory(
      await readTranscript("cli-1.txt"),
      { configPath: compatibilityConfigPath }
    );
    const actualHash = createHash("sha256")
      .update(compatibleConfig.stdout)
      .digest("hex");

    expect(baseline.stdout).toBe(finalOutput);
    expect(compatibleConfig.stdout).toBe(finalOutput);
    expect(actualHash).toBe(expectedHash);
    expect(input).toContain("init 800 600");
  });
});
