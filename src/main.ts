import { createCliApplication } from "./bootstrap/CompositionRoot.js";

const args = process.argv.slice(2);
const configIndex = args.indexOf("--config");
const configArgument =
  configIndex < 0 ? undefined : args[configIndex + 1];
const configuredPath =
  configArgument?.startsWith("--") === true
    ? undefined
    : configArgument;
if (configIndex >= 0 && configuredPath === undefined) {
  process.stdout.write("error: invalid plugin config\n");
}

const application = await createCliApplication(
  process.stdin,
  process.stdout,
  configuredPath === undefined ? {} : { configPath: configuredPath }
);
const exitCode = await application.run();
process.exitCode = exitCode;
