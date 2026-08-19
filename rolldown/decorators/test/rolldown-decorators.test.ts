import { rolldown } from "rolldown";
import type { Plugin, Rollup } from "vite";
import { build, createServer } from "vite";
import { describe, expect, it } from "vitest";
import { rolldownDecorators } from "../src/rolldown-decorators.js";

describe("rolldownDecorators", () => {
	it("creates one pre-transform plugin contract", () => {
		const plugin = rolldownDecorators();

		expect(plugin.name).toBe("rolldown-decorators");
		expect(plugin.transform.order).toBe("pre");
		expect(plugin.transform.filter).toEqual({ code: "@" });
	});

	it("leaves modules without decorator nodes unchanged", async () => {
		const plugin = rolldownDecorators();
		const source = `const email = "person@example.com"; // @notADecorator`;

		expect(await plugin.transform.handler.call({}, source, "example.js")).toBeNull();
		expect(await plugin.transform.handler.call({}, "@media {}", "example.css")).toBeNull();
	});

	it("transforms every public decorator kind with modern context and initializer semantics", async () => {
		const { code } = await bundleSource(`
			const contexts = [];
			function decorate(value, context) {
				contexts.push([context.kind, String(context.name), context.static ?? null, context.private ?? null]);

				if (context.kind === "field") return (initial) => initial + 1;
				if (context.kind === "accessor") return { init: (initial) => initial + 2 };
				if (context.kind === "method") return function (...args) { return value.call(this, ...args) + 3; };
				if (context.kind === "getter") return function () { return value.call(this) + 4; };
				if (context.kind === "setter") return function (next) { return value.call(this, next + 5); };
			}

			@decorate
			class Example {
				@decorate field = 1;
				@decorate accessor accessorValue = 2;
				@decorate #privateField = 2;
				#assigned = 0;

				@decorate method() { return 1; }
				@decorate get assigned() { return this.#assigned; }
				@decorate set assigned(value) { this.#assigned = value; }
				@decorate static staticMethod() { return 2; }

				readPrivate() { return this.#privateField; }
			}

			const instance = new Example();
			instance.assigned = 1;
			globalThis.__decoratorResult = {
				values: [instance.field, instance.accessorValue, instance.readPrivate(), instance.method(), instance.assigned, Example.staticMethod()],
				contexts,
			};
		`);

		expect(code).not.toContain("@decorate");

		const result = await execute<{ contexts: unknown[][]; values: number[] }>(code, "__decoratorResult");

		expect(result.values).toEqual([2, 4, 3, 4, 10, 5]);
		expect(result.contexts).toEqual([
			["method", "staticMethod", true, false],
			["accessor", "accessorValue", false, false],
			["method", "method", false, false],
			["getter", "assigned", false, false],
			["setter", "assigned", false, false],
			["field", "field", false, false],
			["field", "#privateField", false, true],
			["class", "Example", null, null],
		]);
	});

	it("preserves expression evaluation, application order, instance initializers, class replacement, and metadata", async () => {
		const { code } = await bundleSource(`
			const events = [];
			let metadataValue;

			function methodDecorator(name) {
				events.push("evaluate:" + name);
				return (value, context) => {
					events.push("apply:" + name);
					context.addInitializer(function () { events.push("initialize:" + name); });
					return function () { return name + ":" + value.call(this); };
				};
			}

			function writeMetadata(_value, context) { context.metadata.value = 42; }
			function replaceClass(value, context) {
				metadataValue = context.metadata.value;
				context.addInitializer(function () { events.push("initialize:class:" + String(this.replaced)); });
				return class extends value { static replaced = true; };
			}

			@replaceClass
			class Example {
				@writeMetadata field;
				@methodDecorator("outer")
				@methodDecorator("inner")
				method() { return "method"; }
			}

			const instance = new Example();
			globalThis.__decoratorResult = {
				events,
				metadataValue,
				publishedMetadataValue: Example[Symbol.metadata].value,
				replaced: Example.replaced,
				value: instance.method(),
			};
		`);
		const result = await execute<{
			events: string[];
			metadataValue: number;
			publishedMetadataValue: number;
			replaced: boolean;
			value: string;
		}>(code, "__decoratorResult");

		expect(result).toEqual({
			events: [
				"evaluate:outer",
				"evaluate:inner",
				"apply:inner",
				"apply:outer",
				"initialize:class:true",
				"initialize:inner",
				"initialize:outer",
			],
			metadataValue: 42,
			publishedMetadataValue: 42,
			replaced: true,
			value: "outer:inner:method",
		});
	});

	it("initializes methods before fields, evaluates fields and computed names once, and delays class initializers", async () => {
		const { code } = await bundleSource(`
			const events = [];
			const key = () => (events.push("key"), "method");
			const method = (value, context) => {
				context.addInitializer(function () { events.push("method:extra"); });
				return value;
			};
			const field = (_value, context) => {
				context.addInitializer(function () { events.push((context.static ? "static" : "field") + ":extra:" + this[context.name]); });
				return (value) => (events.push((context.static ? "static" : "field") + ":init:" + value), value + 1);
			};
			const klass = (value, context) => {
				context.addInitializer(function () { events.push("class:extra:" + this.count); });
				return value;
			};

			@klass
			class Example {
				@method [key()]() {}
				@field value = (events.push("field:value"), 1);
				@field static count = (events.push("static:value"), 1);
			}

			new Example();
			globalThis.__decoratorResult = events;
		`);

		expect(await execute<string[]>(code, "__decoratorResult")).toEqual([
			"key",
			"static:value",
			"static:init:1",
			"static:extra:2",
			"class:extra:2",
			"method:extra",
			"field:value",
			"field:init:1",
			"field:extra:2",
		]);
	});

	it("transforms private fields, auto-accessors, methods, getters, and setters", async () => {
		const { code } = await bundleSource(`
			const field = () => (_value, _context) => (value) => value + 1;
			const accessor = (value) => ({
				init: (next) => next + 2,
				get() { return value.get.call(this) * 3; },
				set(next) { value.set.call(this, next + 1); },
			});
			const method = (value) => function (...args) { return value.call(this, ...args) + 1; };
			const getter = (value) => function () { return value.call(this) + 1; };
			const setter = (value) => function (next) { value.call(this, next + 1); };

			class Example {
				@field() #x = 1;
				@accessor accessor #y = 1;
				@method #sum(value) { return this.#x + value; }
				@getter get #read() { return 7; }
				@setter set #write(value) { this.saved = value; }
				read() { return [this.#x, this.#y, this.#sum(2), this.#read]; }
				write(value) { this.#y = value; this.#write = value; return this.saved; }
			}

			const instance = new Example();
			globalThis.__decoratorResult = { before: instance.read(), written: instance.write(4), after: instance.read() };
		`);

		expect(await execute(code, "__decoratorResult")).toEqual({
			before: [2, 9, 5, 8],
			written: 5,
			after: [2, 15, 5, 8],
		});
	});

	it("composes multiple field and auto-accessor initializers from inner to outer", async () => {
		const { code } = await bundleSource(`
			const add = (amount) => (_value, _context) => (value) => value + amount;
			const accessor = (amount) => (_value, _context) => ({ init: (value) => value + amount });

			class Example {
				@add(2) @add(1) field = 1;
				@accessor(2) @accessor(1) accessor value = 1;
			}

			const instance = new Example();
			globalThis.__decoratorResult = [instance.field, instance.value];
		`);

		expect(await execute(code, "__decoratorResult")).toEqual([4, 4]);
	});

	it("parses TypeScript and TSX while leaving their non-decorator syntax for the host transform", async () => {
		const { code, map } = await transformSource(
			`
				interface Value { amount: number }
				function decorate(_value: unknown, _context: ClassAccessorDecoratorContext) {}
				class Example { @decorate accessor value: Value = { amount: 1 }; }
				export const node = <div>{new Example().value.amount}</div>;
			`,
			"component.vue?vue&type=script&lang.tsx",
		);

		expect(code).not.toMatch(/@\s*decorate/);
		expect(code).toContain("interface Value");
		expect(code).toContain("<div>");
		expect(JSON.parse(String(map))).toMatchObject({ sources: ["component.vue?vue&type=script&lang.tsx"] });
	});

	it("runs through Rolldown's native transform pipeline", async () => {
		const bundle = await rolldown({
			input: "entry.ts",
			plugins: [
				virtualModule(
					"entry.ts",
					`
						function double(_value: undefined, context: ClassFieldDecoratorContext) {
							return (initial: number) => initial * 2;
						}
						class Example { @double value: number = 21; }
						export const answer = new Example().value;
					`,
				),
				rolldownDecorators(),
			],
		});

		try {
			const { output } = await bundle.generate({ format: "es" });
			const code = output[0]?.type === "chunk" ? output[0].code : "";
			const module = await importModule<{ answer: number }>(code);

			expect(code).not.toMatch(/@\s*double/);
			expect(module.answer).toBe(42);
		} finally {
			await bundle.close();
		}
	});

	it("runs through Vite's production transform pipeline", async () => {
		const result = await build({
			configFile: false,
			logLevel: "silent",
			build: {
				minify: false,
				rollupOptions: {
					input: "virtual:entry",
					output: { format: "es" },
					preserveEntrySignatures: "exports-only",
				},
				write: false,
			},
			plugins: [
				virtualModule(
					"virtual:entry",
					`
						function increment(_value: undefined, _context: ClassFieldDecoratorContext) {
							return (initial: number) => initial + 1;
						}
						class Example { @increment value: number = 41; }
						export const answer = new Example().value;
					`,
				),
				rolldownDecorators(),
			],
		});
		const output = Array.isArray(result) ? result[0]?.output : (result as Rollup.RollupOutput).output;
		const chunk = output.find((entry): entry is Rollup.OutputChunk => entry.type === "chunk");
		const module = await importModule<{ answer: number }>(chunk?.code ?? "");

		expect(chunk?.code).not.toMatch(/@\s*increment/);
		expect(module.answer).toBe(42);
	});

	it("runs through Vite's development transform pipeline", async () => {
		const server = await createServer({
			appType: "custom",
			configFile: false,
			logLevel: "silent",
			optimizeDeps: { noDiscovery: true },
			plugins: [
				virtualModule(
					"/entry.ts",
					`
						function increment(_value: undefined, _context: ClassFieldDecoratorContext) {
							return (initial: number) => initial + 1;
						}
						class Example { @increment value: number = 41; }
						export const answer = new Example().value;
					`,
				),
				rolldownDecorators(),
			],
			server: { hmr: false, middlewareMode: true },
		});

		try {
			const result = await server.transformRequest("/entry.ts");

			expect(result?.code).not.toMatch(/@\s*increment/);
			expect(result?.code).toContain("__decorators_apply");
		} finally {
			await server.close();
		}
	});
});

async function transformSource(source: string, id = "example.js") {
	const result = await rolldownDecorators().transform.handler.call({}, source, id);

	if (result === null || typeof result !== "object" || typeof result.code !== "string") {
		throw new TypeError(`Expected transformed string code for ${id}`);
	}

	return result as { code: string; map: Record<string, unknown> };
}

async function execute<Result>(code: string, key: string): Promise<Result> {
	try {
		await importModule(code);

		return globalThis[key as keyof typeof globalThis] as Result;
	} finally {
		delete globalThis[key as keyof typeof globalThis];
	}
}

async function bundleSource(source: string, id = "example.js") {
	const bundle = await rolldown({
		input: id,
		plugins: [virtualModule(id, source), rolldownDecorators()],
	});

	try {
		const { output } = await bundle.generate({ format: "es" });
		const code = output[0]?.type === "chunk" ? output[0].code : "";

		return { code };
	} finally {
		await bundle.close();
	}
}

function virtualModule(id: string, code: string): Plugin {
	const resolvedId = "\0" + id;

	return {
		name: "test:virtual-module",
		resolveId(source) {
			return source === id ? resolvedId : null;
		},
		load(source) {
			return source === resolvedId ? { code, moduleType: "ts" } : null;
		},
	};
}

async function importModule<Module>(code: string): Promise<Module> {
	return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`) as Promise<Module>;
}
