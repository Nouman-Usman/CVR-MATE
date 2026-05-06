import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      // Resolve @/ imports to the project root (matches tsconfig paths)
      "@": resolve(__dirname, "."),
      // Silence "server-only" package so server modules can be imported in tests
      "server-only": resolve(__dirname, "__tests__/__mocks__/server-only.ts"),
    },
  },
});
