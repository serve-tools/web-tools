import { defineConfig } from "vitest/config";

export const emptyConfig = defineConfig({});
export const flatNodeConfig = defineConfig({ test: { include: ["test/*.test.ts"], environment: "node" } });
export const nodeConfig = defineConfig({ test: { include: ["test/**/*.test.ts"], environment: "node" } });
export const testConfig = defineConfig({ test: { include: ["test/**/*.test.ts"] } });
