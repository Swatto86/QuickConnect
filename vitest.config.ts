import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use jsdom for DOM testing
    environment: "jsdom",

    // Test file patterns
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.spec.ts"],

    // Exclude patterns
    exclude: ["node_modules", "dist", "src-tauri"],

    // Global test timeout
    testTimeout: 10000,

    // Hook timeout
    hookTimeout: 10000,

    // Enable globals (describe, it, expect, etc.)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/__tests__/**",
        "src/**/*.d.ts",
        "src/main.ts",
        "src/hosts.ts",
        "src/error.ts",
        "src/about.ts",
      ],
      // Focus coverage on utility modules which are testable
      thresholds: {
        "src/utils/**": {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
    },

    // Setup files to run before each test file
    setupFiles: ["src/__tests__/setup.ts"],

    // Reporter configuration
    reporters: ["default"],

    // Pool options for better performance
    pool: "forks",

    // Retry failed tests once
    retry: 0,

    // Fail fast on first error (disable for CI)
    bail: 0,

    // Silence console output during tests (can be enabled for debugging)
    silent: false,
  },

  // Resolve configuration for TypeScript and mocking
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@tests": path.resolve(__dirname, "./src/__tests__"),
      // Tauri API mocks
      "@tauri-apps/api/core": path.resolve(
        __dirname,
        "./src/__tests__/mocks/tauri-api.ts",
      ),
      "@tauri-apps/api/event": path.resolve(
        __dirname,
        "./src/__tests__/mocks/tauri-event.ts",
      ),
      "@tauri-apps/api/window": path.resolve(
        __dirname,
        "./src/__tests__/mocks/tauri-window.ts",
      ),
      // Additional Tauri plugin mocks can be added here
      "@tauri-apps/plugin-shell": path.resolve(
        __dirname,
        "./src/__tests__/mocks/tauri-shell.ts",
      ),
      "@tauri-apps/plugin-global-shortcut": path.resolve(
        __dirname,
        "./src/__tests__/mocks/tauri-global-shortcut.ts",
      ),
    },
  },

  // esbuild options
  esbuild: {
    target: "es2020",
  },
});
