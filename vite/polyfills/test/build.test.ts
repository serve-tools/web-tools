import { describe, expect, it } from "vitest";
import { vitePolyfills } from "../src/vite-polyfills.js";
import { buildTest } from "./helpers.js";

const polyfillGlobalNames = ["Composite", "Observable", "Subscriber"] as const;

async function executeWithoutPolyfillGlobals<Receipt>(code: string): Promise<Receipt> {
	const globalDescriptors = polyfillGlobalNames.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
	const whenDescriptor = Object.getOwnPropertyDescriptor(EventTarget.prototype, "when");

	try {
		for (const name of polyfillGlobalNames) {
			Reflect.deleteProperty(globalThis, name);
		}

		Reflect.deleteProperty(EventTarget.prototype, "when");

		const module = (await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)) as {
			receipt: Receipt;
		};

		return module.receipt;
	} finally {
		for (const [index, name] of polyfillGlobalNames.entries()) {
			const descriptor = globalDescriptors[index];

			if (descriptor) {
				Object.defineProperty(globalThis, name, descriptor);
			} else {
				Reflect.deleteProperty(globalThis, name);
			}
		}

		if (whenDescriptor) {
			Object.defineProperty(EventTarget.prototype, "when", whenDescriptor);
		} else {
			Reflect.deleteProperty(EventTarget.prototype, "when");
		}
	}
}

describe("build integration", () => {
	describe("polyfill package side effects", () => {
		const installCases = [
			["composites root", "@serve-tools/polyfill-composites", ['Object.defineProperty(globalThis, "Composite"']],
			[
				"selective Composite",
				"@serve-tools/polyfill-composites/apply/Composite",
				['Object.defineProperty(globalThis, "Composite"'],
			],
			[
				"decorator metadata root",
				"@serve-tools/polyfill-decorator-metadata",
				['Object.defineProperty(Symbol, "metadata"'],
			],
			[
				"selective decorator metadata",
				"@serve-tools/polyfill-decorator-metadata/apply/Symbol/metadata",
				['Object.defineProperty(Symbol, "metadata"'],
			],
			[
				"prioritized task scheduling root",
				"@serve-tools/polyfill-prioritized-task-scheduling",
				[
					"globalThis.scheduler",
					"globalThis.TaskController",
					"globalThis.TaskSignal",
					"globalThis.TaskPriorityChangeEvent",
				],
			],
			[
				"Observable root",
				"@serve-tools/polyfill-observable",
				[
					'Object.defineProperty(globalThis, "Observable"',
					'Object.defineProperty(globalThis, "Subscriber"',
					'Object.defineProperty(EventTargetConstructor.prototype, "when"',
				],
			],
			[
				"selective Observable",
				"@serve-tools/polyfill-observable/apply/Observable",
				['Object.defineProperty(globalThis, "Observable"'],
			],
			[
				"selective Subscriber",
				"@serve-tools/polyfill-observable/apply/Subscriber",
				['Object.defineProperty(globalThis, "Subscriber"'],
			],
			[
				"selective EventTarget.prototype.when",
				"@serve-tools/polyfill-observable/apply/EventTarget/when",
				['Object.defineProperty(EventTargetConstructor.prototype, "when"'],
			],
			[
				"selective scheduler",
				"@serve-tools/polyfill-prioritized-task-scheduling/apply/scheduler",
				["globalThis.scheduler"],
			],
			[
				"selective task controller",
				"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskController",
				["globalThis.TaskController"],
			],
			[
				"selective task signal",
				"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskSignal",
				["globalThis.TaskSignal"],
			],
			[
				"selective task priority change event",
				"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskPriorityChangeEvent",
				["globalThis.TaskPriorityChangeEvent"],
			],
			[
				"idle callback root",
				"@serve-tools/polyfill-request-idle-callback",
				["globalThis.requestIdleCallback", "globalThis.cancelIdleCallback"],
			],
			[
				"selective request idle callback",
				"@serve-tools/polyfill-request-idle-callback/apply/requestIdleCallback",
				["globalThis.requestIdleCallback"],
			],
			[
				"selective cancel idle callback",
				"@serve-tools/polyfill-request-idle-callback/apply/cancelIdleCallback",
				["globalThis.cancelIdleCallback"],
			],
			[
				"resource management root",
				"@serve-tools/polyfill-resource-management",
				[
					'Object.defineProperty(Symbol, "dispose"',
					'Object.defineProperty(Symbol, "asyncDispose"',
					"globalThis.DisposableStack",
					"globalThis.AsyncDisposableStack",
					"globalThis.SuppressedError",
				],
			],
			[
				"selective async disposable stack and its dependencies",
				"@serve-tools/polyfill-resource-management/apply/AsyncDisposableStack",
				[
					'Object.defineProperty(Symbol, "dispose"',
					'Object.defineProperty(Symbol, "asyncDispose"',
					"globalThis.AsyncDisposableStack",
					"globalThis.SuppressedError",
				],
			],
			[
				"selective disposable stack and its dependencies",
				"@serve-tools/polyfill-resource-management/apply/DisposableStack",
				['Object.defineProperty(Symbol, "dispose"', "globalThis.DisposableStack", "globalThis.SuppressedError"],
			],
			[
				"selective suppressed error",
				"@serve-tools/polyfill-resource-management/apply/SuppressedError",
				["globalThis.SuppressedError"],
			],
			[
				"selective async dispose symbol",
				"@serve-tools/polyfill-resource-management/apply/Symbol/asyncDispose",
				['Object.defineProperty(Symbol, "asyncDispose"'],
			],
			[
				"selective dispose symbol",
				"@serve-tools/polyfill-resource-management/apply/Symbol/dispose",
				['Object.defineProperty(Symbol, "dispose"'],
			],
			["URLPattern root", "@serve-tools/polyfill-urlpattern", ["globalThis.URLPattern"]],
			["selective URLPattern", "@serve-tools/polyfill-urlpattern/apply/URLPattern", ["globalThis.URLPattern"]],
		] as const;

		it.each(installCases)("retains the %s installer during tree shaking", async (_name, specifier, expected) => {
			const result = await buildTest({
				files: {
					"index.js": `import ${JSON.stringify(specifier)}; export const retained = true;`,
				},
			});

			const code = result.getChunk("index");

			expect(code).toBeDefined();

			for (const installation of expected) {
				expect(code).toContain(installation);
			}
		});

		const pureCases = [
			["composites", "@serve-tools/polyfill-composites", ["Composite"]],
			["decorator metadata", "@serve-tools/polyfill-decorator-metadata", ["Symbol/metadata"]],
			[
				"prioritized task scheduling",
				"@serve-tools/polyfill-prioritized-task-scheduling",
				["scheduler", "TaskController", "TaskSignal", "TaskPriorityChangeEvent"],
			],
			["Observable", "@serve-tools/polyfill-observable", ["Observable", "Subscriber", "EventTarget/when"]],
			[
				"idle callbacks",
				"@serve-tools/polyfill-request-idle-callback",
				["requestIdleCallback", "cancelIdleCallback"],
			],
			[
				"resource management",
				"@serve-tools/polyfill-resource-management",
				["AsyncDisposableStack", "DisposableStack", "SuppressedError", "Symbol/asyncDispose", "Symbol/dispose"],
			],
			["URLPattern", "@serve-tools/polyfill-urlpattern", ["URLPattern"]],
		] as const;

		it.each(pureCases)(
			"removes unused %s feature imports during tree shaking",
			async (_name, packageName, features) => {
				const imports = features
					.map((feature) => `import ${JSON.stringify(`${packageName}/${feature}`)};`)
					.join("\n");
				const result = await buildTest({
					files: {
						"index.js": `${imports}\nexport const retained = true;`,
					},
				});

				const code = result.getChunk("index");

				expect(code).toBeDefined();
				expect(code?.replace(/\/\/.*$/gm, "").trim()).toMatch(
					/^(?:const|let|var)\s+retained\s*=\s*true;\s*export\s*\{\s*retained\s*\};?$/,
				);
			},
		);
	});

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

	describe("URLPattern polyfill", () => {
		it("injects the owned native-preserving polyfill when URLPattern is constructed", async () => {
			const result = await buildTest({
				files: {
					"index.js": 'export const pattern = new URLPattern({ pathname: "/:id" });',
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");

			expect(code).toBeDefined();
			expect(code).toMatch(/URLPattern(?:\$\d+)? = class \{/);
			expect(code).toContain('globalThis.URLPattern ?? Object.defineProperty(globalThis, "URLPattern"');
		});
	});

	describe("Observable and Composite polyfills", () => {
		it("injects every independently selected native-preserving installer", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						export const composite = Composite({ x: 1 });
						export const observable = new Observable(() => {});
						export const isSubscriber = (value) => value instanceof Subscriber;
						export const events = new EventTarget().when("change");
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");

			expect(code).toBeDefined();
			expect(code).toContain('Object.defineProperty(globalThis, "Composite"');
			expect(code).toContain('Object.defineProperty(globalThis, "Observable"');
			expect(code).toContain('Object.defineProperty(globalThis, "Subscriber"');
			expect(code).toContain('Object.defineProperty(EventTargetConstructor.prototype, "when"');
		});

		it("executes a workspace-linked bundle without self-injecting an installer cycle", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						const first = Composite({ x: 1, y: 2 });
						const second = Composite({ y: 2, x: 1 });
						const values = [];
						const observable = new Observable((subscriber) => {
							if (!(subscriber instanceof Subscriber)) throw new Error("Subscriber identity mismatch");
							subscriber.next(1);
							subscriber.complete();
						});
						observable.subscribe((value) => values.push(value));
						const stream = new EventTarget().when("change");
						export const receipt = {
							compositeIdentity: first === second,
							observableIdentity: stream instanceof Observable,
							values,
						};
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");

			expect(code).toBeDefined();

			const receipt = await executeWithoutPolyfillGlobals<{
				compositeIdentity: boolean;
				observableIdentity: boolean;
				values: number[];
			}>(code ?? "");

			expect(receipt).toEqual({
				compositeIdentity: true,
				observableIdentity: true,
				values: [1],
			});
		});

		it("keeps explicit workspace-linked polyfill imports out of recursive detection", async () => {
			const result = await buildTest({
				files: {
					"index.js": `
						import { Composite as PonyfillComposite } from "@serve-tools/ponyfill-composites";
						import {
							Observable as PonyfillObservable,
							Subscriber as PonyfillSubscriber,
						} from "@serve-tools/ponyfill-observable";
						import "@serve-tools/polyfill-composites";
						import "@serve-tools/polyfill-observable";
						const CompositeConstructor = globalThis["Composite"];
						const ObservableConstructor = globalThis["Observable"];
						const SubscriberConstructor = globalThis["Subscriber"];
						const first = CompositeConstructor({ x: 1, y: 2 });
						const second = CompositeConstructor({ y: 2, x: 1 });
						const values = [];
						const observable = new ObservableConstructor((subscriber) => {
							if (!(subscriber instanceof SubscriberConstructor)) {
								throw new Error("Subscriber identity mismatch");
							}
							subscriber.next(1);
							subscriber.complete();
						});
						observable.subscribe((value) => values.push(value));
						const stream = new EventTarget()["when"]("change");
						export const receipt = {
							compositeIdentity: first === second,
							constructorIdentities: [
								CompositeConstructor === PonyfillComposite,
								ObservableConstructor === PonyfillObservable,
								SubscriberConstructor === PonyfillSubscriber,
							],
							observableIdentity: stream instanceof ObservableConstructor,
							values,
						};
					`,
				},
				plugins: [vitePolyfills()],
			});

			const code = result.getChunk("index");

			expect(code).toBeDefined();

			const receipt = await executeWithoutPolyfillGlobals<{
				compositeIdentity: boolean;
				constructorIdentities: boolean[];
				observableIdentity: boolean;
				values: number[];
			}>(code ?? "");

			expect(receipt).toEqual({
				compositeIdentity: true,
				constructorIdentities: [true, true, true],
				observableIdentity: true,
				values: [1],
			});
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
			expect(code).toContain("globalThis.requestIdleCallback ??");
			expect(code).toContain("globalThis.cancelIdleCallback ??");
		});
	});
});
