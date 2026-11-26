import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "svg-editor-pj1/plugin-api": fileURLToPath(
        new URL("./src/plugin-api/index.ts", import.meta.url)
      )
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true
  }
});
