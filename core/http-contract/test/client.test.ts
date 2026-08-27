import { codec, route } from "@serve-tools/router";
import { describe, expect, it, vi } from "vitest";

import type { HTTPResult } from "../src/client.js";
import { createClient, ProtocolError } from "../src/client.js";
import type { Schema } from "../src/http-contract.js";
import { defineAPI } from "../src/http-contract.js";

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
	responses: { 400: invalid, 401: unauthorized },
	routes: {
		[collection.path]: {
			route: collection,
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
			GET: { operationId: "health", responses: { 200: schema<unknown, { ready: boolean }>(), 205: null } },
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
	const frameworkClient = createClient<typeof exampleAPI, { readonly next?: { readonly tags: readonly string[] } }>();
	const requiredFrameworkClient = createClient<typeof exampleAPI, { readonly trace: string }>({
		fetch(input, init) {
			input satisfies Parameters<typeof globalThis.fetch>[0];
			init?.trace satisfies string | undefined;
			init?.method satisfies string | undefined;
			init?.body satisfies BodyInit | null | undefined;

			if (init) {
				// @ts-expect-error A request may omit init, so required extension metadata is not guaranteed here.
				init.trace satisfies string;
			}

			return globalThis.fetch(input, init);
		},
	});
	createClient<typeof exampleAPI>({ fetch: globalThis.fetch });
	createClient<typeof exampleAPI, { readonly trace: string }>({ fetch: globalThis.fetch });

	await client.GET(health.path);
	await client.GET(health.path, undefined);
	await client.GET(health.path, { init: { headers: { "x-request-id": "optional" } } });
	await frameworkClient.GET(health.path, { init: { cache: "no-store", next: { tags: ["health"] } } });
	await requiredFrameworkClient.GET(health.path);
	await requiredFrameworkClient.GET(health.path, { init: { trace: "health" } });
	await client.GET(collection.path, {
		params: { organizationId: 42 },
		search: { page: 1, cursor: undefined, tag: ["one", "two"] },
	});
	const created = await client.POST(collection.path, {
		params: { organizationId: 42 },
		search: { page: 1 },
		body: { label: "saved" },
	});

	created.status satisfies 201 | 400 | 401 | 413 | 415;
	if (created.status === 201) {
		created.ok satisfies true;
		created.body.id satisfies number;
		created.body.label satisfies string;
	}
	if (created.status === 401) {
		created.ok satisfies false;
		created.body.error satisfies "unauthorized";
	}

	const removed = await client.DELETE(item.path, { params: { organizationId: 42, itemId: 7 } });
	if (removed.status === 204) {
		removed.ok satisfies true;
		removed.body satisfies undefined;
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
	// @ts-expect-error native Fetch metadata belongs inside init
	await client.GET(health.path, { headers: {} });
	// @ts-expect-error the adapter owns the HTTP method
	await client.GET(health.path, { init: { method: "POST" } });
	// @ts-expect-error the adapter owns request-body serialization
	await client.GET(health.path, { init: { body: "hidden" } });
	// @ts-expect-error opaque no-cors responses cannot satisfy a JSON HTTP contract
	await client.GET(health.path, { init: { mode: "no-cors" } });
	// @ts-expect-error undeclared framework extensions require an explicit client generic
	await client.GET(health.path, { init: { next: { tags: ["health"] } } });
	// @ts-expect-error href routes require their prebuilt URL
	await client.GET(custom.path);
	// @ts-expect-error href request options cannot be replaced with undefined
	await client.GET(custom.path, undefined);
	// @ts-expect-error href routes reject generic route serialization
	await client.GET(custom.path, { params: { code: "ABC" } });
	// @ts-expect-error status 204 is absent from createItem and its API-level responses
	created.status === 204;
	// @ts-expect-error status 201 belongs only to createItem
	removed.status === 201;
}

void assertClientTypes;

function assertHTTPResultTypes(
	quoted: HTTPResult<{ readonly "200": typeof publicItem; readonly "400": typeof invalid }>,
	broad: HTTPResult<Readonly<Record<number, Schema>>>,
): void {
	quoted.status satisfies 200 | 400;

	if (quoted.status === 200) {
		quoted.body.label satisfies string;
	} else {
		quoted.body.error satisfies "invalid_request";
	}

	broad.status satisfies number;

	if (broad.ok) {
		broad.body satisfies unknown;
	} else {
		broad.body satisfies unknown;
	}
}

void assertHTTPResultTypes;

describe("createClient", () => {
	it("serializes native route input and forwards native Fetch options", async () => {
		let request: Request | undefined;
		let requestInit: (RequestInit & { readonly next?: { readonly tags: readonly string[] } }) | undefined;
		const controller = new AbortController();
		const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			requestInit = init;
			request = new Request(input, init);

			return Response.json({ id: 7, label: "Saved" }, { status: 201 });
		});
		const client = createClient<typeof exampleAPI, { readonly next?: { readonly tags: readonly string[] } }>({
			baseURL: "https://api.example.test/root/",
			fetch,
		});
		const result = await client.POST(collection.path, {
			params: { organizationId: 42 },
			search: { page: 2, tag: ["release notes", "folder/name"], cursor: undefined },
			body: { label: "Saved" },
			init: {
				credentials: "include",
				headers: { accept: "text/plain", "content-type": "text/plain", "x-request-id": "one" },
				next: { tags: ["items"] },
				signal: controller.signal,
			},
		});

		expect(result).toMatchObject({ ok: true, status: 201, body: { id: 7, label: "Saved" } });
		expect(Object.keys(result).sort()).toEqual(["body", "ok", "response", "status"]);
		expect(result.response).toBeInstanceOf(Response);
		expect(requestInit?.next).toEqual({ tags: ["items"] });
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

	it("returns JSON and no-content responses, then rejects invalid response representations", async () => {
		const nonJSONResponse = new Response("<h1>Bad Gateway</h1>", {
			status: 502,
			headers: { "content-type": "text/html" },
		});
		const malformedResponse = new Response("{", {
			status: 429,
			headers: { "content-type": "application/json" },
		});
		const responses = [
			new Response('{"error":"unauthorized"}', {
				status: 401,
				headers: { "content-type": "Application/Problem+JSON; charset=utf-8" },
			}),
			new Response(null, { status: 204, headers: { "content-type": "application/json" } }),
			new Response(null, { status: 205 }),
			Response.json({ error: "rate_limited" }, { status: 429 }),
			nonJSONResponse,
			malformedResponse,
		];
		const client = createClient<typeof exampleAPI>({ fetch: async () => responses.shift()! });

		const denied = await client.GET(health.path);
		expect(denied).toMatchObject({ ok: false, status: 401, body: { error: "unauthorized" } });

		const empty = await client.DELETE(item.path, { params: { organizationId: 1, itemId: 2 } });
		expect(empty).toMatchObject({ ok: true, status: 204, body: undefined });
		expect(Object.keys(empty).sort()).toEqual(["body", "ok", "response", "status"]);

		const reset = await client.GET(health.path);
		expect(reset).toMatchObject({ ok: true, status: 205, body: undefined });

		const unexpected = await client.GET(health.path);
		expect(unexpected).toMatchObject({ ok: false, status: 429, body: { error: "rate_limited" } });
		expect(unexpected.response.status).toBe(429);

		await expect(client.GET(health.path)).rejects.toMatchObject({
			name: "ProtocolError",
			method: "GET",
			path: health.path,
			status: 502,
			response: nonJSONResponse,
		});
		await expect(client.GET(health.path)).rejects.toMatchObject({
			name: "ProtocolError",
			method: "GET",
			path: health.path,
			status: 429,
			response: malformedResponse,
			cause: expect.any(SyntaxError),
		});
	});

	it("preserves native network failures", async () => {
		const failure = new TypeError("offline");
		const client = createClient<typeof exampleAPI>({
			fetch: async () => {
				throw failure;
			},
		});

		await expect(client.GET(health.path)).rejects.toBe(failure);
	});

	it("preserves bodyless caller metadata without allowing reserved representation headers", async () => {
		let request: Request | undefined;
		const client = createClient<typeof exampleAPI>({
			baseURL: "https://api.example.test/",
			fetch: async (input, init) => {
				request = new Request(input, init);

				return Response.json({ ready: true });
			},
		});

		await client.GET(health.path, {
			init: { headers: { accept: "text/plain", "content-type": "text/plain" } },
		});

		expect(request?.headers.get("accept")).toBe("application/json");
		expect(request?.headers.get("content-type")).toBeNull();
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

	it("rejects opaque mode and adapter-owned init fields before Fetch", async () => {
		const fetch = vi.fn(async () => Response.json({ ready: true }));
		const client = createClient<typeof exampleAPI>({ fetch });
		const get = client.GET as unknown as (path: string, options?: unknown) => Promise<unknown>;

		for (const init of [
			{ mode: "no-cors" },
			{ method: "POST" },
			{ body: "hidden" },
			Object.defineProperty({}, "headers", { enumerable: true, get: () => ({}) }),
		]) {
			await expect(get(health.path, { init })).rejects.toBeInstanceOf(ProtocolError);
		}

		await expect(get(health.path, { headers: {} })).rejects.toBeInstanceOf(ProtocolError);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("rejects unsafe native and prebuilt URLs before Fetch", async () => {
		const fetch = vi.fn(async () => Response.json({ ready: true }));
		const client = createClient<typeof exampleAPI>({ baseURL: "https://api.example.test/", fetch });
		const get = client.GET as unknown as (path: string, options?: unknown) => Promise<unknown>;
		const invalidRequests: readonly [string, unknown][] = [
			["//attacker.example/value", undefined],
			["https://attacker.example/value", undefined],
			["/public/../admin", undefined],
			["/items//value", undefined],
			["/items/", undefined],
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
		expect(result.status).toBe(200);
		expect(result.body).toEqual({ code: "ABC" });
	});
});
