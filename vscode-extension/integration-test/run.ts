import path from "node:path";

import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "..");
  const extensionTestsPath = path.resolve(__dirname, "suite.js");
  const workspacePath = path.resolve(
    extensionDevelopmentPath,
    "integration-test",
    "fixture-workspace"
  );
  const vscodeExecutablePath = process.env["VSCODE_EXECUTABLE_PATH"];

  const exitCode = await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath],
    ...(vscodeExecutablePath === undefined
      ? {}
      : { vscodeExecutablePath })
  });

  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
