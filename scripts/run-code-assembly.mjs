import { createCliApplication } from "../dist/bootstrap/CompositionRoot.js";
import { codePlugins } from "./code-plugins.mjs";

const application = await createCliApplication(
  process.stdin,
  process.stdout,
  { codePlugins }
);
process.exitCode = await application.run();
