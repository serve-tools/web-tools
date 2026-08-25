import { codec, route } from "@serve-tools/router";
import { describe, expect, it, vi } from "vitest";

import { createClient, isStatus } from "../src/client.js";
import type { Schema } from "../src/http-contract.js";
import { defineAPI, ProtocolError } from "../src/http-contract.js";

function schema<Input, Output = Input>(): Schema<Input, Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "client-test",
			validate: (value) => ({ value: value as Output }),
			types: undefined as never,
		},
	};
}

const collection = route("/organizations/:organizationId/items", {
	params: { organizationId: codec.integer() },
	search: {
		page: codec.integer(),
		cursor: codec.string().optional(),
		tag: codec.string().many(),
	},
});
const item = route("/organizations/:organizationId/items/:itemId", {
	params: { organizationId: codec.integer(), itemId: codec.integer() },
});
const health = route("/health");
const custom = route("/custom/:code", {
	params: {
		code: codec.schema({
			parse: (value) => value as Uppercase<string>,
			format: (value: Uppercase<string>) => value,
		}),
	},
});
const publicItem = schema<{ id: number; internal: string }, { id: number; label: string }>();
const itemList = schema<unknown, readonly { id: number; label: string }[]>();
const createItem = schema<{ label: string }, { normalizedLabel: string }>();
const invalid = schema<{ error: "invalid_request" }>();
const unauthorized = schema<{ error: "unauthorized" }>();

const exampleAPI = defineAPI({
	commonResponses: { 400: invalid, 401: unauthorized },
	routes: {
		[collection.path]: {
			route: collection,
			serialization: "native",
			GET: { operationId: "listItems", responses: { 200: itemList } },
			POST: { operationId: "createItem", body: createItem, responses: { 201: publicItem } },
		},
		[item.path]: {
			route: item,
			serialization: "native",
			GET: { operationId: "getItem", responses: { 200: publicItem, 404: schema<{ error: "not_found" }>() } },
			DELETE: { operationId: "deleteItem", responses: { 204: null } },
		},
		[health.path]: {
			route: health,
			serialization: "native",
			GET: { operationId: "health", responses: { 200: schema<unknown, { ready: boolean }>() } },
		},
		[custom.path]: {
			route: custom,
			serialization: "href",
			GET: { operationId: "custom", responses: { 200: schema<unknown, { code: string }>() } },
		},
	},
});

async function assertClientTypes(): Promise<void> {
	const client = createClient<typeof exampleAPI>();

	await client.GET(health.path);
	await client.GET(health.path, undefined);
	await client.GET(health.path, { headers: { "x-request-id": "optional" } });
	await client.GET(collection.path, {
		params: { organizationId: 42 },
		search: { page: 1, cursor: undefined, tag: ["one", "two"] },
	});
	const created = await client.POST(collection.path, {
		params: { organizationId: 42 },
		search: { page: 1 },
		body: { label: "saved" },
	});

	created.status satisfies number;
	if (isStatus(created, 201)) {
		created.data.id satisfies number;
		created.data.label satisfies string;
	}
	if (isStatus(created, 401)) {
		created.error.error satisfies "unauthorized";
	}

	const removed = await client.DELETE(item.path, { params: { organizationId: 42, itemId: 7 } });
	if (isStatus(removed, 204)) {
		removed.data satisfies undefined;
	}

	await client.GET(custom.path, { href: custom.href({ params: { code: "ABC" } }) });

	// @ts-expect-error only declared methods appear on the client
	client.PATCH;
	// @ts-expect-error GET cannot select a path that only supports DELETE
	await client.GET("/missing");
	// @ts-expect-error pathname parameters are required
	await client.GET(item.path);
	// @ts-expect-error required pathname options cannot be replaced with undefined
	await client.GET(item.path, undefined);
	// @ts-expect-error required search values remain required
	await client.GET(collection.path, { params: { organizationId: 42 } });
	// @ts-expect-error integer route inputs remain numbers
	await client.GET(item.path, { params: { organizationId: "42", itemId: 7 } });
	// @ts-expect-error extra pathname parameters are rejected
	await client.GET(item.path, { params: { organizationId: 42, itemId: 7, extra: "no" } });
	// @ts-expect-error POST requires its request body
	await client.POST(collection.path, { params: { organizationId: 42 }, search: { page: 1 } });
	// @ts-expect-error request-body operations cannot omit their request options
	await client.POST(collection.path);
	await client.POST(collection.path, {
		params: { organizationId: 42 },
		search: { page: 1 },
		// @ts-expect-error request schemas expose their input rather than transformed output
		body: { normalizedLabel: "wrong" },
	});
	// @ts-expect-error bodyless operations reject a body
	await client.GET(health.path, { body: {} });
	// @ts-expect-error href routes require their prebuilt URL
	await client.GET(custom.path);
	// @ts-expect-error href request options cannot be replaced with undefined
	await client.GET(custom.path, undefined);
	// @ts-expect-error href routes reject generic route serialization
	await client.GET(custom.path, { params: { code: "ABC" } });
	// @ts-expect-error status 204 is absent from createItem and its common responses
	isStatus(created, 204);
	// @ts-expect-error a delete result cannot use a status belonging only to createItem
	isStatus(removed, 201);
}

void assertClientTypes;

describe("createClient", () => {
	it("serializes native route input and forwards native Fetch options", async () => {
		let request: Request | undefined;
		const controller = new AbortController();
		const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			request = new Request(input, init);

			return Response.json({ id: 7, label: "Saved" }, { status: 201 });
		});
		const client = createClient<typeof exampleAPI>({ baseURL: "https://api.example.test/root/", fetch });
		const result = await client.POST(collection.path, {
			params: { organizationId: 42 },
			search: { page: 2, tag: ["release notes", "folder/name"], cursor: undefined },
			body: { label: "Saved" },
			credentials: "include",
			headers: { accept: "text/plain", "content-type": "text/plain", "x-request-id": "one" },
			signal: controller.signal,
		});

		expect(result).toMatchObject({ kind: "json", ok: true, status: 201, data: { id: 7, label: "Saved" } });
		expect(result.response).toBeInstanceOf(Response);
		expect(request?.url).toBe(
			"https://api.example.test/organizations/42/items?page=2&tag=release+notes&tag=folder%2Fname",
		);
		expect(request?.method).toBe("POST");
		expect(request?.credentials).toBe("include");
		expect(request?.headers.get("accept")).toBe("application/json");
		expect(request?.headers.get("content-type")).toBe("application/json");
		expect(request?.headers.get("x-request-id")).toBe("one");
		expect(await request?.text()).toBe('{"label":"Saved"}');

		controller.abort("cancelled");
		expect(request?.signal.aborted).toBe(true);
		expect(request?.signal.reason).toBe("cancelled");
	});

	it("encodes Unicode and slash boundaries and handles special own parameter names", async () => {
		const urls: string[] = [];
		const client = createClient<typeof exampleAPI>({
			fetch: async (input) => {
				urls.push(String(input));

				return Response.json({ ready: true });
			},
		});
		const runtimeGET = client.GET as unknown as (path: string, options?: unknown) => Promise<unknown>;
		const params = Object.fromEntries([
			["constructor", "café menu"],
			["toString", "folder/name"],
			["hasOwnProperty", 42],
			["__proto__", "safe"],
		]);

		await runtimeGET("/values/:constructor/:toString/:hasOwnProperty/:__proto__", { params });

		expect(urls).toEqual(["/values/caf%C3%A9%20menu/folder%2Fname/42/safe"]);
	});

	it("preserves JSON, no-content, non-JSON, malformed, and undeclared HTTP responses honestly", async () => {
		const responses = [
			new Response('{"error":"unauthorized"}', {
				status: 401,
				headers: { "content-type": "Application/Problem+JSON; charset=utf-8" },
			}),
			new Response(null, { status: 204, headers: { "content-type": "application/json" } }),
			new Response("<h1>Bad Gateway</h1>", { status: 502, headers: { "content-type": "text/html" } }),
			new Response("{", { status: 429, headers: { "content-type": "application/json" } }),
		];
		const client = createClient<typeof exampleAPI>({ fetch: async () => responses.shift()! });

		const denied = await client.GET(health.path);
		expect(isStatus(denied, 401)).toBe(true);
		if (isStatus(denied, 401)) {
			expect(denied.error).toEqual({ error: "unauthorized" });
		}

		const empty = await client.DELETE(item.path, { params: { organizationId: 1, itemId: 2 } });
		expect(empty).toMatchObject({ kind: "empty", ok: true, status: 204, data: undefined });
		expect(isStatus(empty, 204)).toBe(true);

		const html = await client.GET(health.path);
		expect(html).toMatchObject({ kind: "raw", ok: false, status: 502 });
		expect(html.response.bodyUsed).toBe(false);
		expect(isStatus(html, 200)).toBe(false);
		expect(await html.response.text()).toBe("<h1>Bad Gateway</h1>");

		const malformed = await client.GET(health.path);
		expect(malformed).toMatchObject({ kind: "raw", ok: false, status: 429, body: "{" });
		expect(malformed.response.bodyUsed).toBe(true);
		expect(isStatus(malformed, 400)).toBe(false);
	});

	it("preserves bodyless caller headers without transmitting a request body", async () => {
		let request: Request | undefined;
		const client = createClient<typeof exampleAPI>({
			baseURL: "https://api.example.test/",
			fetch: async (input, init) => {
				request = new Request(input, init);

				return Response.json({ ready: true });
			},
		});

		await client.GET(health.path, { headers: { accept: "text/plain", "content-type": "text/plain" } });

		expect(request?.headers.get("accept")).toBe("application/json");
		expect(request?.headers.get("content-type")).toBe("text/plain");
		expect(request?.body).toBeNull();
	});

	it("rejects native network and abort failures unchanged", async () => {
		const networkError = new Error("offline");
		const abortError = new DOMException("cancelled", "AbortError");

		for (const error of [networkError, abortError]) {
			const client = createClient<typeof exampleAPI>({
				fetch: async () => {
					throw error;
				},
			});

			await expect(client.GET(health.path)).rejects.toBe(error);
		}
	});

	it("rejects values outside the JSON wire format before Fetch", async () => {
		const fetch = vi.fn(async () => Response.json({ id: 1, label: "unused" }, { status: 201 }));
		const client = createClient<typeof exampleAPI>({ fetch });
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const accessor = Object.defineProperty({}, "value", { enumerable: true, get: () => "secret" });
		const invalidBodies = [
			undefined,
			1n,
			new Date(),
			new Map(),
			NaN,
			Infinity,
			cyclic,
			accessor,
			{ value: Symbol("no") },
			{ toJSON: () => "hidden" },
		];
		const post = client.POST as unknown as (path: string, options: unknown) => Promise<unknown>;

		for (const body of invalidBodies) {
			await expect(
				post(collection.path, { params: { organizationId: 1 }, search: { page: 1 }, body }),
			).rejects.toBeInstanceOf(ProtocolError);
		}

		expect(fetch).not.toHaveBeenCalled();
	});

	it("rejects unsafe native and prebuilt URLs before Fetch", async () => {
		const fetch = vi.fn(async () => Response.json({ ready: true }));
		const client = createClient<typeof exampleAPI>({ baseURL: "https://api.example.test/", fetch });
		const get = client.GET as unknown as (path: string, options?: unknown) => Promise<unknown>;
		const invalidRequests: readonly [string, unknown][] = [
			["//attacker.example/value", undefined],
			["https://attacker.example/value", undefined],
			["/items/:id", undefined],
			["/items/:id", { params: { id: Number.MAX_SAFE_INTEGER + 1 } }],
			["/items/:id", { params: { id: "" } }],
			["/items/:id", { params: { id: "." } }],
			["/items/:id", { params: { id: ".." } }],
			["/items/:id", { params: { id: "one", extra: "two" } }],
			[custom.path, { href: "//attacker.example/custom/ABC" }],
			[custom.path, { href: "https://attacker.example/custom/ABC" }],
			[custom.path, { href: "/other/ABC" }],
			[custom.path, { href: "/custom/ABC", params: { code: "ABC" } }],
		];

		for (const [path, options] of invalidRequests) {
			await expect(get(path, options)).rejects.toBeInstanceOf(ProtocolError);
		}

		expect(fetch).not.toHaveBeenCalled();
		expect(() => createClient<typeof exampleAPI>({ baseURL: "javascript:alert(1)", fetch })).toThrow(ProtocolError);
	});

	it("accepts matching prebuilt href routes without importing route metadata into the client", async () => {
		let url: string | undefined;
		const client = createClient<typeof exampleAPI>({
			baseURL: "https://api.example.test/",
			fetch: async (input) => {
				url = String(input);

				return Response.json({ code: "ABC" });
			},
		});
		const result = await client.GET(custom.path, { href: custom.href({ params: { code: "ABC" } }) + "?view=full" });

		expect(url).toBe("https://api.example.test/custom/ABC?view=full");
		expect(isStatus(result, 200)).toBe(true);
	});
});
