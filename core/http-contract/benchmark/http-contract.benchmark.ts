import { codec, route } from "@serve-tools/router";
import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { createClient } from "../src/client.js";
import { defineAPI } from "../src/http-contract.js";
import type { AnyRouteEntry, API } from "../src/lib/types.js";
import { toOpenAPI } from "../src/openapi.js";
import { createHandler } from "../src/server.js";

const measurement = { samples: 6, warmup: 2 };
const success = { value: { ok: true } };
const invalid = { issues: [{ message: "Expected a JSON object" }] };

const objectSchema = {
	"~standard": {
		version: 1,
		vendor: "http-contract-benchmark",
		validate(value) {
			return typeof value === "object" && value !== null ? success : invalid;
		},
		jsonSchema: {
			input: () => ({ type: "object" }),
			output: () => ({ type: "object" }),
		},
	},
} satisfies StandardSchemaV1 & StandardJSONSchemaV1;

const createDefinition = (): API => {
	const routes: Record<string, AnyRouteEntry> = {};

	for (let index = 0; index < 26; ++index) {
		const resource = route(`/resources/${index}`);

		routes[resource.path] = {
			route: resource,
			serialization: "native",
			GET: { operationId: `resource${index}`, responses: { 200: objectSchema } },
		};
	}

	const currentItem = route("/items/me");
	const item = route("/items/:id", { params: { id: codec.integer() } });
	const href = route("/href/:id", { params: { id: codec.integer() } });
	const empty = route("/empty");

	routes[currentItem.path] = {
		route: currentItem,
		serialization: "native",
		GET: { operationId: "currentItem", responses: { 200: objectSchema } },
	};
	routes[item.path] = {
		route: item,
		serialization: "native",
		GET: { operationId: "item", responses: { 200: objectSchema } },
		POST: { operationId: "updateItem", body: objectSchema, responses: { 200: objectSchema } },
	};
	routes[href.path] = {
		route: href,
		serialization: "href",
		GET: { operationId: "href", responses: { 200: objectSchema } },
	};
	routes[empty.path] = {
		route: empty,
		serialization: "native",
		DELETE: { operationId: "empty", responses: { 204: null } },
	};

	return { commonResponses: { 400: objectSchema }, routes };
};

const api = defineAPI(createDefinition());
const handlers: Record<
	string,
	() => { readonly status: 200; readonly body: { readonly ok: true } } | { readonly status: 204 }
> = {};

for (let index = 0; index < 26; ++index) {
	handlers[`GET /resources/${index}`] = () => ({ status: 200, body: { ok: true } });
}

handlers["GET /items/me"] = () => ({ status: 200, body: { ok: true } });
handlers["GET /items/:id"] = () => ({ status: 200, body: { ok: true } });
handlers["POST /items/:id"] = () => ({ status: 200, body: { ok: true } });
handlers["GET /href/:id"] = () => ({ status: 200, body: { ok: true } });
handlers["DELETE /empty"] = () => ({ status: 204 });

const createBenchmarkHandler = () => createHandler(api, { handlers } as never);

const jsonFetch: typeof fetch = async () => Response.json({ ok: true });
const rawFetch: typeof fetch = async () => new Response("upstream unavailable", { status: 502 });

interface RuntimeClient {
	readonly GET: (path: string, input?: unknown) => Promise<{ readonly kind?: string; readonly status: number }>;
	readonly POST: (path: string, input?: unknown) => Promise<{ readonly status: number }>;
	readonly DELETE: (path: string, input?: unknown) => Promise<{ readonly status: number }>;
}

test("HTTP contract representative runtime workloads", async () => {
	const nativeClient = createClient({
		baseURL: "https://benchmark.invalid/",
		fetch: jsonFetch,
	}) as unknown as RuntimeClient;
	const rawClient = createClient({
		baseURL: "https://benchmark.invalid/",
		fetch: rawFetch,
	}) as unknown as RuntimeClient;
	const handler = createBenchmarkHandler();
	const runtimeGET = nativeClient.GET;
	const runtimePOST = nativeClient.POST;
	const runtimeDELETE = nativeClient.DELETE;
	const runtimeRawGET = rawClient.GET;

	expect((await runtimeGET("/resources/0")).status).toBe(200);
	expect((await runtimeGET("/items/:id", { params: { id: 42 } })).status).toBe(200);
	expect((await runtimePOST("/items/:id", { params: { id: 42 }, body: { ok: true } })).status).toBe(200);
	expect((await runtimeGET("/href/:id", { href: "/href/42" })).status).toBe(200);
	expect(await runtimeRawGET("/resources/0")).toMatchObject({ kind: "raw", status: 502 });
	expect((await runtimeDELETE("/empty")).status).toBe(200);
	expect((await handler(new Request("https://benchmark.invalid/resources/0"))).status).toBe(200);
	expect((await handler(new Request("https://benchmark.invalid/resources/25"))).status).toBe(200);
	expect((await handler(new Request("https://benchmark.invalid/items/me"))).status).toBe(200);
	expect((await handler(new Request("https://benchmark.invalid/items/42"))).status).toBe(200);
	expect((await handler(new Request("https://benchmark.invalid/missing"))).status).toBe(404);
	expect((await handler(new Request("https://benchmark.invalid/items/42", { method: "PUT" }))).status).toBe(405);
	expect((await handler(new Request("https://benchmark.invalid/items/not-a-number"))).status).toBe(400);
	expect(
		(
			await handler(
				new Request("https://benchmark.invalid/items/42", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(null),
				}),
			)
		).status,
	).toBe(400);
	expect((await handler(new Request("https://benchmark.invalid/empty", { method: "DELETE" }))).status).toBe(204);
	expect(Object.keys(toOpenAPI(api, { info: { title: "Benchmark", version: "1" } }).paths)).toHaveLength(30);

	await benchmark(
		"http-contract/define-api/30-routes",
		() => {
			void defineAPI(createDefinition());
		},
		{
			...measurement,
			iterations: 300,
		},
	);
	await benchmark(
		"http-contract/client/create",
		() => {
			void createClient({ fetch: jsonFetch });
		},
		{
			...measurement,
			iterations: 15_000,
		},
	);
	await benchmark(
		"http-contract/client/native-get",
		async () => {
			await runtimeGET("/resources/0");
		},
		{ ...measurement, iterations: 800 },
	);
	await benchmark(
		"http-contract/client/native-parameter-get",
		async () => {
			await runtimeGET("/items/:id", { params: { id: 42 } });
		},
		{ ...measurement, iterations: 800 },
	);
	await benchmark(
		"http-contract/client/post-json",
		async () => {
			await runtimePOST("/items/:id", { params: { id: 42 }, body: { ok: true } });
		},
		{ ...measurement, iterations: 600 },
	);
	await benchmark(
		"http-contract/client/href-get",
		async () => {
			await runtimeGET("/href/:id", { href: "/href/42" });
		},
		{ ...measurement, iterations: 800 },
	);
	await benchmark(
		"http-contract/client/raw-response",
		async () => {
			await runtimeRawGET("/resources/0");
		},
		{ ...measurement, iterations: 800 },
	);
	await benchmark(
		"http-contract/server/create-handler/30-routes",
		() => {
			void createBenchmarkHandler();
		},
		{
			...measurement,
			iterations: 200,
		},
	);
	await benchmark(
		"http-contract/server/dispatch-first-of-30",
		async () => {
			await handler(new Request("https://benchmark.invalid/resources/0"));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/server/dispatch-last-of-30",
		async () => {
			await handler(new Request("https://benchmark.invalid/resources/25"));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/server/dispatch-static-hit",
		async () => {
			await handler(new Request("https://benchmark.invalid/items/me"));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/server/dispatch-parameter-hit",
		async () => {
			await handler(new Request("https://benchmark.invalid/items/42"));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/server/dispatch-404",
		async () => {
			await handler(new Request("https://benchmark.invalid/missing"));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/server/dispatch-405",
		async () => {
			await handler(new Request("https://benchmark.invalid/items/42", { method: "PUT" }));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/server/dispatch-invalid-parameter",
		async () => {
			await handler(new Request("https://benchmark.invalid/items/not-a-number"));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/server/dispatch-invalid-body",
		async () => {
			await handler(
				new Request("https://benchmark.invalid/items/42", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: "null",
				}),
			);
		},
		{ ...measurement, iterations: 400 },
	);
	await benchmark(
		"http-contract/server/dispatch-204",
		async () => {
			await handler(new Request("https://benchmark.invalid/empty", { method: "DELETE" }));
		},
		{ ...measurement, iterations: 500 },
	);
	await benchmark(
		"http-contract/openapi/project-30-routes",
		() => {
			toOpenAPI(api, { info: { title: "Benchmark", version: "1" } });
		},
		{ ...measurement, iterations: 80 },
	);
});
