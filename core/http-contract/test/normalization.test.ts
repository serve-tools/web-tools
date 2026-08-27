import { codec, route } from "@serve-tools/router";
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it, vi } from "vitest";
import type { Schema } from "../src/http-contract.js";
import { adapterResponse, composeAPIs, defineAPI, ProtocolError } from "../src/http-contract.js";
import { toOpenAPI } from "../src/openapi.js";
import { createHandler } from "../src/server.js";

const json: Schema & StandardJSONSchemaV1 = {
	"~standard": {
		version: 1,
		vendor: "normalization-test",
		validate: (value) => ({ value }),
		jsonSchema: { input: () => ({}), output: () => ({}) },
	},
};

describe("contract normalization", () => {
	it("freezes library-owned defaults and snapshots documentation metadata", () => {
		const tags = ["notes"];
		const scopes = ["read"];
		const requirement = { auth: scopes };
		const security = [requirement];
		const api = defineAPI({
			routes: { "/items": { POST: { body: json, tags, security, responses: { 200: json } } } },
		});
		const operation = api.routes["/items"].POST;
		const standard = operation.responses[400]["~standard"];
		expect(Reflect.set(standard, "validate", () => ({ value: null }))).toBe(false);
		expect(Reflect.set(standard.jsonSchema, "output", () => ({}))).toBe(false);
		tags.push("changed");
		scopes.push("write");
		security.push({ auth: [] });
		expect(operation.tags).toEqual(["notes"]);
		expect(operation.security).toEqual([{ auth: ["read"] }]);
		expect(Object.isFrozen(operation.security[0]!.auth)).toBe(true);
	});

	it("infers routes, preserves absent IDs, and materializes only applicable defaults without mutation", () => {
		const declaration = {
			routes: {
				"/health": { GET: { responses: { 200: json } } },
				"/items/:id": { GET: { responses: { 200: json } } },
				"/items": { POST: { body: json, responses: { 201: json } } },
			},
		};
		const api = defineAPI(declaration);
		expect(api.routes["/items/:id"].route.match("https://test/items/abc")?.params).toEqual({ id: "abc" });
		expect(api.routes["/items/:id"].route.href({ params: { id: "a/b" } })).toBe("/items/a%2Fb");
		expect(api.routes["/health"].GET).not.toHaveProperty("operationId");
		expect(Object.keys(api.routes["/health"].GET.responses)).toEqual(["200"]);
		expect(Object.keys(api.routes["/items/:id"].GET.responses)).toEqual(["200", "400"]);
		expect(Object.keys(api.routes["/items"].POST.responses)).toEqual(["201", "400", "413", "415"]);
		expect(api).not.toHaveProperty("responses");
		expect(declaration.routes["/items/:id"]).not.toHaveProperty("route");
		expect(Object.keys(declaration.routes["/items"].POST.responses)).toEqual(["201"]);
		expect(Object.isFrozen(api.routes["/items"].POST.responses)).toBe(true);
		expect(defineAPI(api)).toEqual(api);
	});

	it("normalizes query defaults and respects explicit API-level or operation schemas", () => {
		const searchRoute = route("/search", { search: { page: codec.integer().optional() } });
		const own = adapterResponse(json, () => ({ source: "operation" }));
		const apiLevel = adapterResponse(json, () => ({ source: "api-level" }));
		const local = defineAPI({ routes: { "/search": { route: searchRoute, GET: { responses: { 200: json } } } } });
		expect(Object.keys(local.routes["/search"].GET.responses)).toEqual(["200", "400"]);
		const api = defineAPI({
			responses: { 413: apiLevel },
			routes: { "/items": { POST: { body: json, responses: { 201: json, 400: own } } } },
		});
		expect(api.routes["/items"].POST.responses[400]).toBe(own);
		expect(api.routes["/items"].POST.responses).not.toHaveProperty("413");
		expect(api.responses[413]).toBe(apiLevel);
	});

	it("ignores inherited response defaults and rejects an explicitly undefined route", () => {
		const inherited = Object.assign(Object.create({ 400: json }), { 401: json }) as { 401: typeof json };
		const api = defineAPI({
			responses: inherited,
			routes: { "/:id": { GET: { responses: { 200: json } } } },
		});
		expect(api.responses).not.toHaveProperty("400");
		expect(api.routes["/:id"].GET.responses).toHaveProperty("400");
		expect(() =>
			defineAPI({ routes: { "/": { route: undefined, GET: { responses: { 200: json } } } } } as never),
		).toThrowError(/explicit route/);
	});

	it("preserves adapter defaults and custom producers through nested scoped composition", async () => {
		const first400 = adapterResponse(json, () => ({ source: "first" }));
		const second400 = adapterResponse(json, () => ({ source: "second" }));
		const first = defineAPI({
			responses: { 400: first400 },
			routes: { "/first": { POST: { body: json, responses: { 200: json } } } },
		});
		const second = defineAPI({
			responses: { 400: second400 },
			routes: { "/second": { POST: { body: json, responses: { 200: json } } } },
		});
		const health = defineAPI({ routes: { "/health": { GET: { responses: { 200: json } } } } });
		const composed = composeAPIs(composeAPIs(first, second), health);
		expect(composed.routes["/first"].POST.responses[400]).toBe(first400);
		expect(composed.routes["/second"].POST.responses[400]).toBe(second400);
		expect(Object.keys(composed.routes["/health"].GET.responses)).toEqual(["200"]);
		const handlers = {
			"POST /first": () => ({ status: 200 as const, body: null }),
			"POST /second": () => ({ status: 200 as const, body: null }),
			"GET /health": () => ({ status: 200 as const, body: null }),
		};
		const handle = createHandler(composed, { handlers });
		const request = (path: string) =>
			new Request(`https://test/${path}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{",
			});
		for (const path of ["first", "second"]) {
			expect(await (await handle(request(path))).json()).toEqual({ source: path });
		}
		const global400 = adapterResponse(json, () => ({ source: "global" }));
		const global = createHandler(composeAPIs({ responses: { 400: global400 } }, composed), { handlers });
		expect(await (await global(request("first"))).json()).toEqual({ source: "global" });
	});

	it("preserves schema transforms and JSON Schema identity without invoking producers for docs or handlers", async () => {
		const transformed: Schema<{ code: string }, { message: string }> &
			StandardJSONSchemaV1<{ code: string }, { message: string }> = {
			"~standard": {
				version: 1,
				vendor: "normalization-test",
				validate: async (value) =>
					typeof (value as { code?: unknown })?.code === "string"
						? { value: { message: (value as { code: string }).code.toUpperCase() } }
						: { issues: [{ message: "Expected code" }] },
				jsonSchema: {
					input: () => ({ type: "object", properties: { code: { type: "string" } } }),
					output: () => ({ type: "object", properties: { message: { type: "string" } } }),
				},
			},
		};
		const producer = vi.fn(async ({ status }: { status: number }) => ({ code: `adapter-${status}` }));
		const wrapped = adapterResponse(transformed, producer);
		expect(wrapped["~standard"]).toBe(transformed["~standard"]);
		const api = defineAPI({
			routes: { "/items": { POST: { body: json, responses: { 200: json, 400: wrapped } } } },
		});
		const document = toOpenAPI(api, { info: { title: "Test", version: "1" } });
		expect(document.paths["/items"]!.post!.responses[400]!.content?.["application/json"].schema).toEqual({
			type: "object",
			properties: { message: { type: "string" } },
		});
		const handle = createHandler(api, {
			handlers: { "POST /items": () => ({ status: 400, body: { code: "handler" } }) },
		});
		expect(producer).not.toHaveBeenCalled();
		const valid = new Request("https://test/items", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "null",
		});
		expect(await (await handle(valid)).json()).toEqual({ message: "HANDLER" });
		expect(producer).not.toHaveBeenCalled();
		const invalid = new Request("https://test/items", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{",
		});
		expect(await (await handle(invalid)).json()).toEqual({ message: "ADAPTER-400" });
		expect(producer).toHaveBeenCalledExactlyOnceWith({ request: invalid, status: 400 });
	});

	it("rejects malformed wrappers and removed handler options", () => {
		expect(() => adapterResponse(null as unknown as Schema, () => null)).toThrowError(ProtocolError);
		expect(() => adapterResponse(json, null as never)).toThrowError(ProtocolError);
		expect(() =>
			adapterResponse({ "~standard": { version: 1, validate: () => ({ value: null }) } } as never, null as never),
		).toThrowError(/Standard Schema/);
		const api = defineAPI({ routes: { "/": { GET: { responses: { 200: json } } } } });
		expect(() =>
			createHandler(api, {
				handlers: { "GET /": () => ({ status: 200, body: null }) },
				// @ts-expect-error Adapter producers live beside their schemas, not in handler options.
				errorBodies: { 400: () => null },
			}),
		).toThrowError(/adapterResponse/);
		const handlers = { "GET /": () => ({ status: 200 as const, body: null }) };
		for (const options of [
			Object.defineProperty({ handlers }, "errorBodies", { value: {} }),
			Object.assign(Object.create({ errorBodies: {} }), { handlers }),
		]) {
			expect(() => createHandler(api, options)).toThrowError(/adapterResponse/);
		}
	});
});
