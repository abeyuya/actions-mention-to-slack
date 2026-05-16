import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["__tests__/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "**/fixture/**"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text", "html", "lcov"],
    },
  },
});
