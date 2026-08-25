import { codec, route } from "@serve-tools/router";
import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it } from "vitest";

import { defineAPI } from "../src/http-contract.js";
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
	it("projects deterministic OpenAPI 3.1 operations through Standard JSON Schema", () => {
		const api = defineAPI({
			commonResponses: { 401: missing },
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
			{ name: "organizationId", in: "path", required: true, schema: { type: "string" } },
			{ name: "itemId", in: "path", required: true, schema: { type: "string" } },
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
		expect(remove?.responses["204"]).toEqual({ description: "Successful response" });
		expect(remove?.responses["204"]?.content).toBeUndefined();
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
});
