import { describe, expect, it } from "vitest";
import { vitePolyfills } from "../src/vite-polyfills.js";
import { buildTest } from "./helpers.js";

describe("build integration", () => {
	describe("Symbol.dispose polyfill", () => {
		it("injects polyfill when Symbol.dispose is referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						const obj = {
							[Symbol.dispose]() {
								console.log('disposed');
							}
						};
						export { obj };
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");
			expect(code).toBeDefined();
			// Check that the polyfill code is present
			expect(code).toContain("Symbol.dispose");
			expect(code).toContain("Object.defineProperty");
		});

		it("does not inject polyfill when Symbol.dispose is not referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						const obj = {
							[Symbol.iterator]() {
								return [];
							}
						};
						export { obj };
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");

			expect(code).toBeDefined();

			// The polyfill is not injected when Symbol.dispose is not referenced
			expect(code).not.toContain("Object.defineProperty");
		});

		it("does not inject polyfill when Symbol.dispose is only in a string", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						const msg = "Symbol.dispose is cool";
						export { msg };
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");

			expect(code).toBeDefined();

			expect(code).not.toContain("Object.defineProperty");
		});
	});

	describe("Symbol.metadata polyfill", () => {
		it("injects the decorator metadata symbol when Symbol.metadata is referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": "export const metadata = Symbol.metadata;",
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");
			expect(code).toBeDefined();
			expect(code).toContain('Object.defineProperty(Symbol, "metadata"');
			expect(code).toContain('Symbol("Symbol.metadata")');
		});
	});

	describe("Explicit resource management global built-ins polyfill", () => {
		it("injects polyfill when DisposableStack is referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
							export const stack = new DisposableStack();
						`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");
			expect(code).toBeDefined();
			expect(code).toContain("globalThis.DisposableStack");
			expect(code).toContain("class DisposableStack");
			expect(code).toContain("Symbol.dispose");
		});
	});

	describe("Map upsert polyfill", () => {
		it("injects polyfill when getOrInsert is referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						const cache = new Map();
						export const value = cache.getOrInsert("k", 1);
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");
			expect(code).toBeDefined();
			expect(code).toContain("getOrInsert");
			expect(code).toContain("Object.defineProperties");
		});

		it("injects polyfill when getOrInsertComputed is referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						const cache = new Map();
						export const value = cache.getOrInsertComputed("k", () => 1);
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");
			expect(code).toBeDefined();
			expect(code).toContain("getOrInsertComputed");
			expect(code).toContain("Object.defineProperties");
		});

		it("does not inject polyfill when only standard Map methods are referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						const cache = new Map();
						cache.set("k", 1);
						export const value = cache.get("k");
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");
			expect(code).toBeDefined();
			expect(code).not.toContain("Object.defineProperties");
		});
	});

	describe("idle callback polyfill", () => {
		it("injects both idle callback globals when they are referenced", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						export const handle = requestIdleCallback(() => {});
						cancelIdleCallback(handle);
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");
			expect(code).toBeDefined();
			expect(code).toContain('Object.defineProperty(globalThis, "requestIdleCallback"');
			expect(code).toContain('Object.defineProperty(globalThis, "cancelIdleCallback"');
		});
	});
});
