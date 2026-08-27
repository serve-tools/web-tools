import { codec, route } from "@serve-tools/router";
import { describe, expect, it, vi } from "vitest";

import type { Schema } from "../src/http-contract.js";
import { defineAPI } from "../src/http-contract.js";
import { createStaticClient, ProtocolError } from "../src/static-client.js";

function schema<Input, Output = Input>(): Schema<Input, Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "static-client-test",
			validate: (value) => ({ value: value as Output }),
			types: undefined as never,
		},
	};
}

const health = route("/health");
const note = route("/note");
const parameter = route("/items/:id", { params: { id: codec.integer() } });
const search = route("/items", { search: { cursor: codec.string().optional() } });
const href = route("/custom");
const output = schema<unknown, { ready: boolean }>();
const noteInput = schema<{ note: string }>();
const error = schema<{ error: string }>();

const exampleAPI = defineAPI({
	routes: {
		[health.path]: {
			route: health,
			GET: { operationId: "health", responses: { 200: output, 205: null, 503: error } },
		},
		[note.path]: {
			route: note,
			serialization: "native",
			PUT: { operationId: "putNote", body: noteInput, responses: { 204: null, 400: error } },
		},
		[parameter.path]: {
			route: parameter,
			GET: { operationId: "parameter", responses: { 200: output } },
		},
		[search.path]: {
			route: search,
			serialization: "native",
			GET: { operationId: "search", responses: { 200: output } },
		},
		[href.path]: {
			route: href,
			serialization: "href",
			GET: { operationId: "href", responses: { 200: output } },
		},
	},
});

async function assertStaticClientTypes(): Promise<void> {
	const client = createStaticClient<typeof exampleAPI>();
	const frameworkClient = createStaticClient<typeof exampleAPI, { readonly cacheTags?: readonly string[] }>();
	const requiredFrameworkClient = createStaticClient<typeof exampleAPI, { readonly trace: string }>({
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
	createStaticClient<typeof exampleAPI>({ fetch: globalThis.fetch });
	createStaticClient<typeof exampleAPI, { readonly trace: string }>({ fetch: globalThis.fetch });
	const healthy = await client.GET(health.path);

	if (healthy.status === 200) {
		healthy.body.ready satisfies boolean;
	}
	if (healthy.status === 503) {
		healthy.body.error satisfies string;
	}

	await client.PUT(note.path, { body: { note: "saved" } });
	await frameworkClient.GET(health.path, { init: { cacheTags: ["health"] } });
	await requiredFrameworkClient.GET(health.path);
	await requiredFrameworkClient.GET(health.path, { init: { trace: "health" } });

	// @ts-expect-error body operations require their request options
	await client.PUT(note.path);
	// @ts-expect-error bodyless operations reject a body
	await client.GET(health.path, { body: {} });
	// @ts-expect-error native Fetch metadata belongs inside init
	await client.GET(health.path, { signal: new AbortController().signal });
	// @ts-expect-error the adapter owns the HTTP method
	await client.GET(health.path, { init: { method: "POST" } });
	// @ts-expect-error the adapter owns request-body serialization
	await client.GET(health.path, { init: { body: "hidden" } });
	// @ts-expect-error opaque no-cors responses cannot satisfy a JSON HTTP contract
	await client.GET(health.path, { init: { mode: "no-cors" } });
	// @ts-expect-error pathname parameters require the general client
	await client.GET(parameter.path);
	// @ts-expect-error declared search inputs require the general client, even when optional
	await client.GET(search.path);
	// @ts-expect-error href serialization requires the general client
	await client.GET(href.path);
	// @ts-expect-error status 204 is not declared by the health operation
	healthy.status === 204;
	// @ts-expect-error only methods with eligible static routes appear
	client.POST;
}

void assertStaticClientTypes;

describe("createStaticClient", () => {
	it("calls static routes with native Fetch options and safe JSON bodies", async () => {
		const requests: Request[] = [];
		const controller = new AbortController();
		const client = createStaticClient<typeof exampleAPI>({
			baseURL: "https://api.example.test/root/",
			fetch: async (input, init) => {
				requests.push(new Request(input, init));

				return requests.length === 1 ? Response.json({ ready: true }) : new Response(null, { status: 204 });
			},
		});

		const healthy = await client.GET(health.path, {
			init: {
				credentials: "include",
				headers: { accept: "text/plain", "x-request-id": "one" },
				signal: controller.signal,
			},
		});
		const saved = await client.PUT(note.path, { body: { note: "saved" } });

		expect(healthy).toMatchObject({ ok: true, status: 200, body: { ready: true } });
		expect(Object.keys(healthy).sort()).toEqual(["body", "ok", "response", "status"]);
		expect(healthy.status).toBe(200);
		expect(saved).toMatchObject({ ok: true, status: 204, body: undefined });
		expect(saved.status).toBe(204);
		expect(requests[0]?.url).toBe("https://api.example.test/health");
		expect(requests[0]?.method).toBe("GET");
		expect(requests[0]?.credentials).toBe("include");
		expect(requests[0]?.headers.get("accept")).toBe("application/json");
		expect(requests[0]?.headers.get("x-request-id")).toBe("one");
		expect(requests[1]?.url).toBe("https://api.example.test/note");
		expect(requests[1]?.headers.get("content-type")).toBe("application/json");
		expect(await requests[1]?.text()).toBe('{"note":"saved"}');

		controller.abort("cancelled");
		expect(requests[0]?.signal.aborted).toBe(true);
		expect(requests[0]?.signal.reason).toBe("cancelled");
	});

	it("rejects non-JSON responses and invalid local inputs before Fetch", async () => {
		const response = new Response("<h1>Unavailable</h1>", { status: 502 });
		const fetch = vi.fn(async () => response);
		const client = createStaticClient<typeof exampleAPI>({ fetch });
		const result = client.GET(health.path);

		await expect(result).rejects.toMatchObject({
			name: "ProtocolError",
			message: "An HTTP response must use a JSON media type.",
			method: "GET",
			path: health.path,
			status: 502,
			response,
		});
		expect(response.bodyUsed).toBe(false);

		const get = client.GET as unknown as (path: string, options?: unknown) => Promise<unknown>;
		const put = client.PUT as unknown as (path: string, options: unknown) => Promise<unknown>;
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;

		await expect(get("//attacker.example/value")).rejects.toBeInstanceOf(ProtocolError);
		await expect(get(42 as never)).rejects.toBeInstanceOf(ProtocolError);
		await expect(get("/items/:id")).rejects.toBeInstanceOf(ProtocolError);
		await expect(get("/items?cursor=one")).rejects.toBeInstanceOf(ProtocolError);
		await expect(put(note.path, { body: cyclic })).rejects.toBeInstanceOf(ProtocolError);
		await expect(get(health.path, { init: { mode: "no-cors" } })).rejects.toBeInstanceOf(ProtocolError);
		await expect(get(health.path, { init: { method: "POST" } })).rejects.toBeInstanceOf(ProtocolError);
		await expect(get(health.path, { init: { body: "hidden" } })).rejects.toBeInstanceOf(ProtocolError);
		await expect(get(health.path, { credentials: "include" })).rejects.toBeInstanceOf(ProtocolError);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(() => createStaticClient<typeof exampleAPI>({ baseURL: "javascript:alert(1)", fetch })).toThrow(
			ProtocolError,
		);
	});

	it("preserves declared errors and no-content results while rejecting malformed JSON", async () => {
		const malformedResponse = new Response("{", {
			status: 500,
			headers: { "content-type": "application/json" },
		});
		const responses = [
			Response.json({ error: "unavailable" }, { status: 503 }),
			malformedResponse,
			new Response(null, { status: 205 }),
		];
		const client = createStaticClient<typeof exampleAPI>({ fetch: async () => responses.shift()! });

		const unavailable = await client.GET(health.path);
		expect(unavailable).toMatchObject({
			ok: false,
			status: 503,
			body: { error: "unavailable" },
		});
		expect(unavailable.status).toBe(503);

		await expect(client.GET(health.path)).rejects.toMatchObject({
			name: "ProtocolError",
			message: "An HTTP response contained invalid JSON.",
			method: "GET",
			path: health.path,
			status: 500,
			response: malformedResponse,
			cause: expect.any(SyntaxError),
		});
		expect(malformedResponse.bodyUsed).toBe(true);

		const reset = await client.GET(health.path);
		expect(reset).toMatchObject({ ok: true, status: 205, body: undefined });
		expect(reset.status).toBe(205);
	});
});
