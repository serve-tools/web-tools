import { codec, route } from "@serve-tools/router";
import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it } from "vitest";

import { composeAPIs, defineAPI } from "../src/http-contract.js";
import { toOpenAPI } from "../src/openapi.js";

type VendorSchema = StandardSchemaV1 & StandardJSONSchemaV1;

function schema(input: Record<string, unknown>, output: Record<string, unknown>): VendorSchema {
	return {
		"~standard": {
			version: 1,
			vendor: "test-validator",
			validate: () => ({ value: undefined }),
			jsonSchema: {
				input: () => input,
				output: () => output,
			},
		},
	};
}

const itemsRoute = route("/organizations/:organizationId/items/:itemId", {
	params: { organizationId: codec.integer(), itemId: codec.integer() },
});
const itemInput = schema({ type: "object", title: "item-input" }, { type: "object", title: "item-output" });
const itemOutput = schema(
	{ type: "object", title: "item-response-input" },
	{ type: "object", title: "item-response-output" },
);
const missing = schema({ const: "missing-input" }, { const: "missing-output" });

describe("toOpenAPI", () => {
	it("omits custom decoded defaults that cannot describe the URL wire value", () => {
		const custom = codec.schema({
			parse: (value: string) => ({ value: BigInt(value) }),
			format: (value: { value: bigint }) => String(value.value),
		});
		const selected = route("/custom", {
			search: {
				one: custom.default({ value: 1n }),
				many: custom.many().default([{ value: 2n }]),
			},
		});
		const api = defineAPI({
			routes: {
				[selected.path]: {
					route: selected,
					serialization: "href",
					GET: { operationId: "customDefaults", responses: { 200: itemOutput } },
				},
			},
		});
		const document = toOpenAPI(api, { info: { title: "Defaults", version: "1" } });
		expect(document.paths["/custom"]?.get?.parameters).toEqual([
			{ name: "many", in: "query", required: false, schema: { type: "array", items: { type: "string" } } },
			{ name: "one", in: "query", required: false, schema: { type: "string" } },
		]);
		expect(() => JSON.stringify(document)).not.toThrow();
	});

	it("projects deterministic OpenAPI 3.1 operations through Standard JSON Schema", () => {
		const api = defineAPI({
			responses: { 401: missing },
			routes: {
				[itemsRoute.path]: {
					route: itemsRoute,
					serialization: "native",
					DELETE: { operationId: "deleteItem", responses: { 204: null, 404: missing } },
					PATCH: {
						operationId: "updateItem",
						summary: "Update one item",
						body: itemInput,
						responses: { 200: itemOutput },
					},
				},
			},
		});

		const options = { info: { title: "Items", version: "1.0.0" } };
		const first = toOpenAPI(api, options);
		const second = toOpenAPI(api, options);
		const path = first.paths["/organizations/{organizationId}/items/{itemId}"];
		const patch = path?.patch;
		const remove = path?.delete;

		expect(first.openapi).toBe("3.1.0");
		expect(JSON.stringify(first)).toBe(JSON.stringify(second));
		expect(path?.parameters).toEqual([
			{
				name: "organizationId",
				in: "path",
				required: true,
				schema: { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },
			},
			{
				name: "itemId",
				in: "path",
				required: true,
				schema: { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },
			},
		]);
		expect(patch).toMatchObject({
			operationId: "updateItem",
			summary: "Update one item",
			requestBody: { content: { "application/json": { schema: { title: "item-input" } } } },
			responses: {
				200: { content: { "application/json": { schema: { title: "item-response-output" } } } },
				401: { content: { "application/json": { schema: { const: "missing-output" } } } },
			},
		});
		expect(remove?.responses["204"]).toEqual({ description: "No Content" });
		expect(remove?.responses["204"]?.content).toBeUndefined();
	});

	it("uses standard descriptions for declared and API-level statuses", () => {
		const api = defineAPI({
			responses: { 503: missing },
			routes: {
				"/items": {
					route: route("/items"),
					serialization: "native",
					GET: {
						operationId: "getItems",
						responses: { 200: itemOutput, 422: missing, 599: missing },
					},
				},
			},
		});

		const responses = toOpenAPI(api, { info: { title: "Items", version: "1.0.0" } }).paths["/items"]?.get
			?.responses;

		expect(responses?.["200"]?.description).toBe("OK");
		expect(responses?.["422"]?.description).toBe("Unprocessable Content");
		expect(responses?.["503"]?.description).toBe("Service Unavailable");
		expect(responses?.["599"]?.description).toBe("HTTP 599 response");
	});

	it("preserves component-scoped API-level response descriptions when composed", () => {
		const withUnavailable = defineAPI({
			responses: { 503: missing },
			routes: {
				"/available": {
					route: route("/available"),
					serialization: "native",
					GET: { operationId: "available", responses: { 200: itemOutput } },
				},
			},
		});
		const withoutUnavailable = defineAPI({
			routes: {
				"/ready": {
					route: route("/ready"),
					serialization: "native",
					GET: { operationId: "ready", responses: { 200: itemOutput } },
				},
			},
		});
		const document = toOpenAPI(composeAPIs(withUnavailable, withoutUnavailable), {
			info: { title: "Composed", version: "1.0.0" },
		});

		expect(document.paths["/available"]?.get?.responses["503"]?.description).toBe("Service Unavailable");
		expect(document.paths["/ready"]?.get?.responses["503"]).toBeUndefined();
	});

	it("reports the exact operation when a schema cannot produce JSON Schema", () => {
		const unsupported = {
			"~standard": {
				version: 1 as const,
				vendor: "test-validator",
				validate: () => ({ value: undefined }),
			},
		};
		const api = defineAPI({
			routes: {
				"/items": {
					route: route("/items"),
					serialization: "native",
					GET: { operationId: "listItems", responses: { 200: unsupported } },
				},
			},
		});

		expect(() => toOpenAPI(api, { info: { title: "Items", version: "1.0.0" } })).toThrow(
			"GET /items (listItems) response 200 does not implement Standard JSON Schema conversion.",
		);
	});

	it("projects codec metadata for path and query parameters deterministically", () => {
		const itemRoute = route("/items/:id/:kind", {
			params: { id: codec.integer(), kind: codec.enum("book", "film") },
			search: {
				tags: codec.string().many(),
				limit: codec.integer().default(10),
				optional: codec.string().optional(),
			},
		});
		const operation = toOpenAPI(
			defineAPI({
				routes: {
					[itemRoute.path]: {
						route: itemRoute,
						serialization: "native",
						GET: { operationId: "items", responses: { 200: itemOutput } },
					},
				},
			}),
			{ info: { title: "Items", version: "1.0.0" } },
		).paths["/items/{id}/{kind}"]?.get;

		expect(operation?.parameters).toEqual([
			{
				name: "limit",
				in: "query",
				required: false,
				schema: {
					type: "integer",
					minimum: Number.MIN_SAFE_INTEGER,
					maximum: Number.MAX_SAFE_INTEGER,
					default: 10,
				},
			},
			{ name: "optional", in: "query", required: false, schema: { type: "string" } },
			{
				name: "tags",
				in: "query",
				required: false,
				schema: { type: "array", items: { type: "string" }, default: [] },
			},
		]);
	});

	it("projects only typed documentation metadata without generated-structure overrides", () => {
		const api = defineAPI({
			routes: {
				"/items": {
					route: route("/items"),
					serialization: "native",
					GET: {
						description: "Lists the visible items.",
						tags: ["items"],
						deprecated: false,
						security: [{ bearer: [] }],
						responses: { 200: itemOutput },
					},
				},
			},
		});
		const document = toOpenAPI(api, {
			info: { title: "Items", version: "1.0.0" },
			servers: [{ url: "https://api.example.test", description: "Production" }],
			tags: [{ name: "items", description: "Item operations" }],
			securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
			security: [{ bearer: [] }],
		});

		expect(document).toMatchObject({
			servers: [{ url: "https://api.example.test", description: "Production" }],
			tags: [{ name: "items", description: "Item operations" }],
			security: [{ bearer: [] }],
			components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
			paths: {
				"/items": {
					get: {
						description: "Lists the visible items.",
						tags: ["items"],
						deprecated: false,
						security: [{ bearer: [] }],
					},
				},
			},
		});
		expect(document.paths["/items"]?.get?.operationId).toBeUndefined();
	});

	it("rejects invalid OpenAPI documentation references only when projected", () => {
		const api = defineAPI({
			routes: {
				"/items": {
					route: route("/items"),
					serialization: "native",
					GET: { security: [{ missing: [] }], responses: { 200: itemOutput } },
				},
			},
		});

		expect(() => toOpenAPI(api, { info: { title: "Items", version: "1" } })).toThrow("undeclared scheme");
		expect(() =>
			toOpenAPI(api, {
				info: { title: "Items", version: "1" },
				tags: [{ name: "items" }, { name: "items" }],
				securitySchemes: { missing: { type: "http", scheme: "bearer" } },
			}),
		).toThrow("unique names");
	});

	it("rejects equivalent templated path collisions", () => {
		const api = defineAPI({
			routes: {
				"/items/:id": {
					route: route("/items/:id"),
					serialization: "native",
					GET: { operationId: "one", responses: { 200: itemOutput } },
				},
				"/items/:itemId": {
					route: route("/items/:itemId"),
					serialization: "native",
					POST: { operationId: "two", responses: { 201: itemOutput } },
				},
			},
		});
		expect(() => toOpenAPI(api, { info: { title: "Items", version: "1.0.0" } })).toThrow("route paths collide");
	});
});
