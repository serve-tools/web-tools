import { describe, expect, it } from "vitest";
import type { VitePolyfillsOptions } from "../src/vite-polyfills.js";
import { builtinPolyfills, definePolyfill, vitePolyfills } from "../src/vite-polyfills.js";
import { transformTest } from "./helpers.js";

const VIRTUAL_PREFIX = "virtual:@serve-tools/vite-polyfill/";
const VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "symbol-dispose";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;
const SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "symbol-async-dispose";
const RESOLVED_SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID = "\0" + SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID;
const SYMBOL_METADATA_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "symbol-metadata";
const RESOLVED_SYMBOL_METADATA_VIRTUAL_MODULE_ID = "\0" + SYMBOL_METADATA_VIRTUAL_MODULE_ID;
const DISPOSABLE_STACK_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "disposable-stack";
const RESOLVED_DISPOSABLE_STACK_VIRTUAL_MODULE_ID = "\0" + DISPOSABLE_STACK_VIRTUAL_MODULE_ID;
const ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "async-disposable-stack";
const RESOLVED_ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID = "\0" + ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID;
const SUPPRESSED_ERROR_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "suppressed-error";
const RESOLVED_SUPPRESSED_ERROR_VIRTUAL_MODULE_ID = "\0" + SUPPRESSED_ERROR_VIRTUAL_MODULE_ID;
const URL_PATTERN_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "url-pattern";
const RESOLVED_URL_PATTERN_VIRTUAL_MODULE_ID = "\0" + URL_PATTERN_VIRTUAL_MODULE_ID;
const REQUEST_IDLE_CALLBACK_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "request-idle-callback";
const RESOLVED_REQUEST_IDLE_CALLBACK_VIRTUAL_MODULE_ID = "\0" + REQUEST_IDLE_CALLBACK_VIRTUAL_MODULE_ID;
const CANCEL_IDLE_CALLBACK_VIRTUAL_MODULE_ID = VIRTUAL_PREFIX + "cancel-idle-callback";
const RESOLVED_CANCEL_IDLE_CALLBACK_VIRTUAL_MODULE_ID = "\0" + CANCEL_IDLE_CALLBACK_VIRTUAL_MODULE_ID;

describe("vitePolyfills", () => {
	describe("plugin shape", () => {
		it("returns a valid plugin object", () => {
			const options: VitePolyfillsOptions = {};
			const plugin = vitePolyfills(options);

			expect(plugin.name).toBe("vite-plugin-polyfills");
			expect(plugin.enforce).toBe("pre");
		});

		it("has required hooks", () => {
			const plugin = vitePolyfills();

			expect(plugin.resolveId).toBeDefined();
			expect(plugin.load).toBeDefined();
			expect(plugin.transform).toBeDefined();
		});
	});

	describe("virtual module", () => {
		it("resolves virtual module id", () => {
			const plugin = vitePolyfills();
			const resolveId = plugin.resolveId as (id: string) => string | null;

			expect(resolveId(VIRTUAL_MODULE_ID)).toBe(RESOLVED_VIRTUAL_MODULE_ID);
			expect(resolveId("other-module")).toBeNull();
		});

		it("loads polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose";');
			expect(load("other-module")).toBeNull();
		});

		it("loads Symbol.asyncDispose polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"@serve-tools/polyfill-resource-management/apply/Symbol/asyncDispose";');
			expect(load("other-module")).toBeNull();
		});

		it("loads Symbol.metadata polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_SYMBOL_METADATA_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"@serve-tools/polyfill-decorator-metadata/apply/Symbol/metadata";');
			expect(load("other-module")).toBeNull();
		});

		it("loads DisposableStack polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_DISPOSABLE_STACK_VIRTUAL_MODULE_ID);
			expect(code).toContain('import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose"');
			expect(code).toContain('import"@serve-tools/polyfill-resource-management/apply/DisposableStack"');
			expect(load("other-module")).toBeNull();
		});

		it("loads AsyncDisposableStack polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID);
			expect(code).toContain('import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose"');
			expect(code).toContain('import"@serve-tools/polyfill-resource-management/apply/Symbol/asyncDispose"');
			expect(code).toContain('import"@serve-tools/polyfill-resource-management/apply/AsyncDisposableStack"');
			expect(load("other-module")).toBeNull();
		});

		it("loads SuppressedError polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_SUPPRESSED_ERROR_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"@serve-tools/polyfill-resource-management/apply/SuppressedError";');
			expect(load("other-module")).toBeNull();
		});

		it("loads URLPattern polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_URL_PATTERN_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"urlpattern-polyfill";');
			expect(load("other-module")).toBeNull();
		});

		it("loads requestIdleCallback polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_REQUEST_IDLE_CALLBACK_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"@serve-tools/polyfill-request-idle-callback/apply/requestIdleCallback";');
			expect(load("other-module")).toBeNull();
		});

		it("loads cancelIdleCallback polyfill code for virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_CANCEL_IDLE_CALLBACK_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"@serve-tools/polyfill-request-idle-callback/apply/cancelIdleCallback";');
			expect(load("other-module")).toBeNull();
		});
	});

	describe("transform behavior", () => {
		const matchingCases = [
			["Symbol.dispose", "const x = Symbol.dispose;", "file.js", VIRTUAL_MODULE_ID],
			[
				"Symbol.asyncDispose",
				"const x = Symbol.asyncDispose;",
				"file.js",
				SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID,
			],
			["Symbol.metadata", "const x = Symbol.metadata;", "file.js", SYMBOL_METADATA_VIRTUAL_MODULE_ID],
			["DisposableStack", "const stack = new DisposableStack();", "file.js", DISPOSABLE_STACK_VIRTUAL_MODULE_ID],
			[
				"AsyncDisposableStack",
				"const stack = new AsyncDisposableStack();",
				"file.js",
				ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID,
			],
			[
				"SuppressedError",
				"const match = error instanceof SuppressedError;",
				"file.js",
				SUPPRESSED_ERROR_VIRTUAL_MODULE_ID,
			],
			[
				"URLPattern",
				"const pattern = new URLPattern({ pathname: '/:id' });",
				"file.js",
				URL_PATTERN_VIRTUAL_MODULE_ID,
			],
			[
				"requestIdleCallback",
				"const handle = requestIdleCallback(work);",
				"file.js",
				REQUEST_IDLE_CALLBACK_VIRTUAL_MODULE_ID,
			],
			["cancelIdleCallback", "cancelIdleCallback(handle);", "file.js", CANCEL_IDLE_CALLBACK_VIRTUAL_MODULE_ID],
			["a type reference", "type Stack = DisposableStack;", "file.ts", DISPOSABLE_STACK_VIRTUAL_MODULE_ID],
			["a declaration", "const DisposableStack = MyLocalThing;", "file.js", DISPOSABLE_STACK_VIRTUAL_MODULE_ID],
			[
				"an import",
				"import { DisposableStack } from './shim.js';",
				"file.js",
				DISPOSABLE_STACK_VIRTUAL_MODULE_ID,
			],
			["a property", "source.DisposableStack;", "file.js", DISPOSABLE_STACK_VIRTUAL_MODULE_ID],
			["globalThis", "globalThis.DisposableStack;", "file.js", DISPOSABLE_STACK_VIRTUAL_MODULE_ID],
			[
				"a later declaration",
				"function make(){ return new DisposableStack(); } const DisposableStack = MyLocalThing;",
				"file.js",
				DISPOSABLE_STACK_VIRTUAL_MODULE_ID,
			],
			[
				"a later import",
				"const make = () => new DisposableStack(); import { DisposableStack } from './shim.js';",
				"file.js",
				DISPOSABLE_STACK_VIRTUAL_MODULE_ID,
			],
			[
				"a nested reference",
				"function make(){ return new DisposableStack(); }",
				"file.js",
				DISPOSABLE_STACK_VIRTUAL_MODULE_ID,
			],
			["TypeScript syntax", "const x: symbol = Symbol.dispose;", "file.ts", VIRTUAL_MODULE_ID],
			["TSX syntax", "const node = <div>{String(Symbol.dispose)}</div>;", "file.tsx", VIRTUAL_MODULE_ID],
			["a query suffix", "const x = Symbol.dispose;", "file.ts?import", VIRTUAL_MODULE_ID],
		] as const;

		it.each(matchingCases)("injects the expected polyfill for %s", async (_name, code, id, virtualId) => {
			const transformed = await transformTest({ code, id, plugins: [vitePolyfills()] });

			expect(transformed).toContain(`import"${virtualId}"`);
			expect(transformed).toContain(code);
		});

		const nonMatchingCases = [
			["non-script files", ".class { color: red; }", "styles.css"],
			["node_modules", "export default new DisposableStack();", "/project/node_modules/pkg/index.js"],
			["unrelated symbols", "const x = Symbol.iterator;", "file.js"],
			["string contents", 'const msg = "Symbol.dispose is cool";', "file.js"],
		] as const;

		it.each(nonMatchingCases)("does not inject a polyfill for %s", async (_name, code, id) => {
			const transformed = await transformTest({ code, id, plugins: [vitePolyfills()] });

			expect(transformed).not.toContain(VIRTUAL_PREFIX);
		});
	});

	describe("options.polyfills", () => {
		const customPolyfill = definePolyfill({
			id: "custom-feature",
			code: "/* custom runtime */",
			detect: (found) => ({
				MemberExpression(node) {
					if (node.computed) {
						return;
					}

					if (node.object.type !== "Identifier" || node.object.name !== "MyAPI") {
						return;
					}

					if (node.property.type !== "Identifier" || node.property.name !== "feature") {
						return;
					}

					found();
				},
			}),
		});

		it("exposes the built-in polyfill list", () => {
			const ids = builtinPolyfills.map((polyfill) => polyfill.id);
			expect(ids).toEqual([
				"async-disposable-stack",
				"cancel-idle-callback",
				"disposable-stack",
				"map-upsert",
				"request-idle-callback",
				"scheduler",
				"suppressed-error",
				"symbol-async-dispose",
				"symbol-dispose",
				"symbol-metadata",
				"task-controller",
				"task-signal",
				"url-pattern",
			]);
		});

		it("registers a custom polyfill's virtual module", () => {
			const plugin = vitePolyfills({ polyfills: [customPolyfill] });
			const resolveId = plugin.resolveId as (id: string) => string | null;
			const load = plugin.load as (id: string) => string | null;

			expect(resolveId(VIRTUAL_PREFIX + "custom-feature")).toBe("\0" + VIRTUAL_PREFIX + "custom-feature");
			expect(load("\0" + VIRTUAL_PREFIX + "custom-feature")).toBe("/* custom runtime */");
		});

		it("detects a custom polyfill in user code", async () => {
			const plugin = vitePolyfills({ polyfills: [customPolyfill] });
			const transformed = await transformTest({ code: "MyAPI.feature();", plugins: [plugin] });

			expect(transformed).toContain(`import"${VIRTUAL_PREFIX}custom-feature"`);
		});

		it("omits built-ins when an explicit list is provided", () => {
			const plugin = vitePolyfills({ polyfills: [customPolyfill] });
			const resolveId = plugin.resolveId as (id: string) => string | null;

			expect(resolveId(VIRTUAL_MODULE_ID)).toBeNull();
		});

		it("composes built-ins with custom polyfills", async () => {
			const plugin = vitePolyfills({ polyfills: [...builtinPolyfills, customPolyfill] });
			const transformed = await transformTest({
				code: "const x = Symbol.dispose; new DisposableStack(); MyAPI.feature();",
				plugins: [plugin],
			});

			expect(transformed).toContain(`import"${VIRTUAL_MODULE_ID}"`);
			expect(transformed).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
			expect(transformed).toContain(`import"${VIRTUAL_PREFIX}custom-feature"`);
		});

		it("throws on duplicate polyfill ids", () => {
			expect(() => vitePolyfills({ polyfills: [customPolyfill, customPolyfill] })).toThrow(
				/duplicate polyfill id/,
			);
		});
	});

	describe("map-upsert polyfill", () => {
		const MAP_UPSERT_VIRTUAL = VIRTUAL_PREFIX + "map-upsert";

		it("loads the runtime via the virtual module", () => {
			const plugin = vitePolyfills();
			const load = plugin.load as (id: string) => string | null;

			const code = load(`\0${MAP_UPSERT_VIRTUAL}`);
			expect(code).toContain("getOrInsert");
			expect(code).toContain("getOrInsertComputed");
		});

		it.each(["cache.getOrInsert(key, value);", "cache.getOrInsertComputed(key, () => 1);"])(
			"injects the runtime for %s",
			async (code) => {
				const transformed = await transformTest({ code, plugins: [vitePolyfills()] });

				expect(transformed).toContain(`import"${MAP_UPSERT_VIRTUAL}"`);
			},
		);

		it.each([
			"cache.get(key); cache.set(key, value);",
			'const msg = "use getOrInsert";',
			'cache["getOrInsert"](key, value);',
		])("does not inject the runtime for %s", async (code) => {
			const transformed = await transformTest({ code, plugins: [vitePolyfills()] });

			expect(transformed).not.toContain(MAP_UPSERT_VIRTUAL);
		});
	});
});
