import { codec, route } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it, vi } from "vitest";

import { adapterResponse, composeAPIs, defineAPI, ProtocolError } from "../src/http-contract.js";
import { assertJSONValue, isJSONMediaType } from "../src/lib/json.js";
import { createHandler } from "../src/server.js";

type ValidationResult<Output> = StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>>;

function schema<Input, Output = Input>(
	validate: (value: unknown) => ValidationResult<Output>,
): StandardSchemaV1<Input, Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "server-test",
			validate,
		},
	};
}

function valid<Output>(value: Output): StandardSchemaV1.SuccessResult<Output> {
	return { value };
}

function invalid(message = "private submitted value"): StandardSchemaV1.FailureResult {
	return { issues: [{ message }] };
}

const unknownSchema = schema<unknown>((value) => valid(value));
const defaultErrors = {
	400: schema<{ error: "invalid_request" }>((value) =>
		JSON.stringify(value) === '{"error":"invalid_request"}'
			? valid(value as { error: "invalid_request" })
			: invalid(),
	),
	413: schema<{ error: "request_too_large" }>((value) =>
		JSON.stringify(value) === '{"error":"request_too_large"}'
			? valid(value as { error: "request_too_large" })
			: invalid(),
	),
	415: schema<{ error: "unsupported_media_type" }>((value) =>
		JSON.stringify(value) === '{"error":"unsupported_media_type"}'
			? valid(value as { error: "unsupported_media_type" })
			: invalid(),
	),
};

describe("JSON wire helpers", () => {
	it("recognizes only application JSON media types", () => {
		for (const value of [
			"application/json",
			"APPLICATION/JSON; Charset=UTF-8",
			"application/problem+json",
			" application/vnd.example+json ; version=2",
		]) {
			expect(isJSONMediaType(value)).toBe(true);
		}

		for (const value of [null, "text/json", "text/problem+json", "application/jsonp", "application/+json", ""]) {
			expect(isJSONMediaType(value)).toBe(false);
		}
	});

	it("accepts exact JSON trees including null-prototype records and shared references", () => {
		const shared = { value: true };
		const nullPrototype = Object.assign(Object.create(null), { safe: [shared, shared] });

		expect(() => assertJSONValue(nullPrototype)).not.toThrow();
	});

	it("rejects values whose JSON serialization would be lossy or executable", () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;

		const accessor = {};
		Object.defineProperty(accessor, "secret", { enumerable: true, get: () => "value" });

		const sparse = Array<unknown>(1);
		const extraArrayProperty = Object.assign([true], { extra: true });
		const arraySymbolProperty = [true] as unknown as Record<PropertyKey, unknown>;
		arraySymbolProperty[Symbol("hidden")] = true;
		const nonEnumerableArrayValue = [true];
		Object.defineProperty(nonEnumerableArrayValue, "0", { enumerable: false });
		const arrayAccessor = [true];
		Object.defineProperty(arrayAccessor, "0", { enumerable: true, get: () => true });
		const symbolProperty = { safe: true } as Record<PropertyKey, unknown>;
		symbolProperty[Symbol("hidden")] = true;

		for (const value of [
			undefined,
			1n,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			new Date(),
			new Map(),
			() => undefined,
			cyclic,
			accessor,
			sparse,
			extraArrayProperty,
			arraySymbolProperty,
			nonEnumerableArrayValue,
			arrayAccessor,
			symbolProperty,
			{ toJSON: () => "hidden" },
		]) {
			expect(() => assertJSONValue(value, "a request body")).toThrowError(ProtocolError);
		}
	});
});

describe("createHandler", () => {
	it("keeps allowed methods and 405 schemas inside matching native pathname domains", async () => {
		const integer = route("/items/:id", {
			params: { id: codec.integer() },
			search: { page: codec.integer().optional() },
		});
		const literal = route("/items/me");
		const hrefInteger = route("/href-items/:id", { params: { id: codec.integer() } });
		const hrefLiteral = route("/href-items/me");
		const parameter405 = schema((value) =>
			(value as { error?: unknown })?.error === "parameter_method"
				? valid({ error: "parameter_method" })
				: invalid(),
		);
		const literal405 = schema((value) =>
			(value as { error?: unknown })?.error === "literal_method" ? valid({ error: "literal_method" }) : invalid(),
		);
		const api = defineAPI({
			responses: { 400: defaultErrors[400] },
			routes: {
				[integer.path]: {
					route: integer,
					GET: { operationId: "integer", responses: { 200: unknownSchema, 405: parameter405 } },
				},
				[literal.path]: {
					route: literal,
					POST: {
						operationId: "literal",
						responses: {
							200: unknownSchema,
							405: adapterResponse(literal405, () => ({ error: "literal_method" })),
						},
					},
				},
				[hrefInteger.path]: {
					route: hrefInteger,
					serialization: "href",
					GET: { operationId: "hrefInteger", responses: { 200: unknownSchema } },
				},
				[hrefLiteral.path]: {
					route: hrefLiteral,
					POST: { operationId: "hrefLiteral", responses: { 200: unknownSchema } },
				},
			},
		});
		const handle = createHandler(api, {
			handlers: {
				"GET /items/:id": ({ params }) => ({ status: 200, body: params.id }),
				"POST /items/me": () => ({ status: 200, body: "literal" }),
				"GET /href-items/:id": ({ params }) => ({ status: 200, body: params.id }),
				"POST /href-items/me": () => ({ status: 200, body: "literal" }),
			},
		});
		for (const method of ["GET", "PATCH"]) {
			const response = await handle(new Request("https://api.test/items/me", { method }));
			expect(response.status).toBe(405);
			expect(response.headers.get("allow")).toBe("POST");
			expect(await response.json()).toEqual({ error: "literal_method" });
		}
		expect((await handle(new Request("https://api.test/href-items/me"))).status).toBe(400);
		expect(await (await handle(new Request("https://api.test/items/%34%32"))).json()).toBe(42);
		for (const path of ["/items/invalid", "/items/42?page=invalid"]) {
			expect((await handle(new Request(`https://api.test${path}`))).status).toBe(400);
		}

		const enumeration = route("/labels/:kind", { params: { kind: codec.enum("me") } });
		const labelId = route("/labels/:id", { params: { id: codec.integer() } });
		const labels = defineAPI({
			responses: { 400: defaultErrors[400] },
			routes: {
				[enumeration.path]: {
					route: enumeration,
					GET: { operationId: "enum", responses: { 200: unknownSchema } },
				},
				[labelId.path]: { route: labelId, POST: { operationId: "labelId", responses: { 200: unknownSchema } } },
			},
		});
		const labelHandler = createHandler(labels, {
			handlers: {
				"GET /labels/:kind": ({ params }) => ({ status: 200, body: params.kind }),
				"POST /labels/:id": ({ params }) => ({ status: 200, body: params.id }),
			},
		});
		expect(await (await labelHandler(new Request("https://api.test/labels/%6De"))).json()).toBe("me");
		const unsupported = await labelHandler(new Request("https://api.test/labels/%6De", { method: "PATCH" }));
		expect(unsupported.headers.get("allow")).toBe("GET");
	});

	it("preserves application headers on JSON, empty, and context responses", async () => {
		const endpoint = route("/headers");
		const api = defineAPI({
			responses: { 401: unknownSchema },
			routes: {
				[endpoint.path]: {
					route: endpoint,
					GET: { operationId: "readHeaders", responses: { 200: unknownSchema } },
					DELETE: { operationId: "deleteHeaders", responses: { 204: null } },
					POST: { operationId: "resetHeaders", responses: { 205: null } },
				},
			},
		});
		const handle = createHandler(api, {
			context: (input) => {
				if (input.request.headers.has("x-denied")) {
					return input.respond({
						status: 401,
						body: { error: "unauthorized" },
						headers: { "WWW-Authenticate": "Bearer" },
					});
				}
				if (input.method === "DELETE" && input.request.headers.has("x-cached")) {
					return input.respond({ status: 204, headers: { "Cache-Control": "max-age=60" } });
				}
			},
			handlers: {
				"GET /headers": () => ({
					status: 200,
					body: { ok: true },
					headers: [
						["Cache-Control", "no-store"],
						["Set-Cookie", "first=1"],
						["Set-Cookie", "second=2"],
					],
				}),
				"DELETE /headers": () => ({ status: 204, headers: { ETag: '"deleted"' } }),
				"POST /headers": () => ({ status: 205, headers: { ETag: '"reset"' } }),
			},
		});
		const response = await handle(new Request("https://api.test/headers"));
		expect(response.headers.get("content-type")).toBe("application/json");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.getSetCookie()).toEqual(["first=1", "second=2"]);
		expect(await response.json()).toEqual({ ok: true });
		for (const method of ["DELETE", "POST"]) {
			const empty = await handle(new Request("https://api.test/headers", { method }));
			expect(empty.body).toBeNull();
			expect(empty.headers.has("content-type")).toBe(false);
			expect(empty.headers.has("etag")).toBe(true);
		}
		const denied = await handle(new Request("https://api.test/headers", { headers: { "x-denied": "yes" } }));
		expect(denied.status).toBe(401);
		expect(denied.headers.get("www-authenticate")).toBe("Bearer");
		const cached = await handle(
			new Request("https://api.test/headers", { method: "DELETE", headers: { "x-cached": "yes" } }),
		);
		expect(cached.body).toBeNull();
		expect(cached.headers.get("cache-control")).toBe("max-age=60");
	});

	it("rejects invalid headers and attempts to override response framing", async () => {
		const endpoint = route("/headers");
		const api = defineAPI({
			routes: {
				[endpoint.path]: {
					route: endpoint,
					GET: { operationId: "headers", responses: { 200: unknownSchema, 204: null } },
				},
			},
		});
		for (const name of ["Content-Type", "Content-Length", "Content-Encoding", "Transfer-Encoding", "bad\nname"]) {
			for (const empty of [false, true]) {
				const handle = createHandler(api, {
					handlers: {
						"GET /headers": () =>
							empty
								? { status: 204, headers: { [name]: "invalid" } }
								: { status: 200, body: null, headers: { [name]: "invalid" } },
					},
				});
				await expect(handle(new Request("https://api.test/headers"))).rejects.toMatchObject({
					name: "ProtocolError",
					operationId: "headers",
					status: empty ? 204 : 200,
				});
			}
		}
	});

	it("dispatches static and parameterized routes with decoded router values", async () => {
		const staticRoute = route("/items/me");
		const itemRoute = route("/items/:id", {
			params: { id: codec.integer() },
			search: {
				kind: codec.enum("new", "popular").default("new"),
				tag: codec.string().many(),
				q: codec.string().optional(),
			},
		});
		const api = defineAPI({
			responses: defaultErrors,
			routes: {
				[staticRoute.path]: {
					route: staticRoute,
					serialization: "native",
					GET: { operationId: "currentItem", responses: { 200: unknownSchema } },
				},
				[itemRoute.path]: {
					route: itemRoute,
					serialization: "native",
					GET: { operationId: "getItem", responses: { 200: unknownSchema } },
				},
			},
		});
		const currentItem = vi.fn(() => ({ status: 200 as const, body: { selected: "literal" } }));
		const getItem = vi.fn(({ params, search }) => ({ status: 200 as const, body: { params, search } }));
		const handle = createHandler(api, {
			handlers: {
				"GET /items/me": currentItem,
				"GET /items/:id": getItem,
			},
		});

		const literal = await handle(new Request("https://api.test/items/me"));
		const parameter = await handle(
			new Request("https://api.test/items/42?tag=one&tag=two&q=road+map&kind=popular"),
		);

		expect(await literal.json()).toEqual({ selected: "literal" });
		expect(await parameter.json()).toEqual({
			params: { id: 42 },
			search: { kind: "popular", tag: ["one", "two"], q: "road map" },
		});
		expect(currentItem).toHaveBeenCalledOnce();
		expect(getItem).toHaveBeenCalledOnce();
	});

	it("rejects crossing templates that could dispatch a typed call to another operation", () => {
		const earlyLiteral = route("/a/x/:value");
		const lateLiteral = route("/a/:id/b");
		expect(() =>
			defineAPI({
				routes: {
					[lateLiteral.path]: {
						route: lateLiteral,
						serialization: "native",
						GET: { operationId: "lateLiteral", responses: { 200: unknownSchema } },
					},
					[earlyLiteral.path]: {
						route: earlyLiteral,
						serialization: "native",
						GET: { operationId: "earlyLiteral", responses: { 200: unknownSchema } },
					},
				},
			}),
		).toThrowError(/Ambiguous HTTP route templates/);
	});

	it("preserves encoded literal matching beside disjoint native parameters", async () => {
		const literal = route("/café/résumé");
		const parameter = route("/café/:name", { params: { name: codec.enum("other") } });
		const api = defineAPI({
			responses: { 400: defaultErrors[400] },
			routes: {
				[parameter.path]: {
					route: parameter,
					serialization: "native",
					GET: { operationId: "parameter", responses: { 200: unknownSchema } },
				},
				[literal.path]: {
					route: literal,
					serialization: "native",
					GET: { operationId: "literal", responses: { 200: unknownSchema } },
				},
			},
		});
		const handle = createHandler(api, {
			handlers: {
				"GET /café/:name": () => ({ status: 200, body: "parameter" }),
				"GET /café/résumé": () => ({ status: 200, body: "literal" }),
			},
		});

		expect(await (await handle(new Request("https://api.test/caf%C3%A9/r%C3%A9sum%C3%A9"))).json()).toBe("literal");
		expect(await (await handle(new Request("https://api.test/caf%C3%A9/other"))).json()).toBe("parameter");
	});

	it("rejects same-method overlapping templates with identical specificity", () => {
		const first = route("/users/:id");
		const second = route("/users/:name");

		expect(() => {
			defineAPI({
				routes: {
					[first.path]: {
						route: first,
						serialization: "native",
						GET: { operationId: "first", responses: { 200: unknownSchema } },
					},
					[second.path]: {
						route: second,
						serialization: "native",
						GET: { operationId: "second", responses: { 200: unknownSchema } },
					},
				},
			});
		}).toThrowError(ProtocolError);
	});

	it("returns safe 404 and stable 405 responses without invoking application code", async () => {
		const items = route("/items");
		const missing = schema<{ code: "not_found" }, { error: "not_found" }>((value) =>
			JSON.stringify(value) === '{"code":"not_found"}' ? valid({ error: "not_found" }) : invalid(),
		);
		const methodNotAllowed = schema<{ code: "method_not_allowed" }, { error: "method_not_allowed" }>((value) =>
			JSON.stringify(value) === '{"code":"method_not_allowed"}'
				? valid({ error: "method_not_allowed" })
				: invalid(),
		);
		const api = defineAPI({
			responses: {
				404: adapterResponse(missing, () => ({ code: "not_found" })),
				405: adapterResponse(methodNotAllowed, () => ({ code: "method_not_allowed" })),
			},
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					POST: { operationId: "create", responses: { 201: unknownSchema } },
					DELETE: { operationId: "delete", responses: { 204: null } },
				},
			},
		});
		const context = vi.fn(() => ({ user: 1 }));
		const post = vi.fn(() => ({ status: 201 as const, body: null }));
		const remove = vi.fn(() => ({ status: 204 as const }));
		const handle = createHandler(api, {
			context,
			handlers: { "POST /items": post, "DELETE /items": remove },
		});
		const invalidAPI = defineAPI({
			...api,
			responses: {
				404: adapterResponse(missing, () => ({ code: "wrong" }) as never),
				405: adapterResponse(methodNotAllowed, () => ({ code: "wrong" }) as never),
			},
		});
		const invalidHandle = createHandler(invalidAPI, {
			handlers: { "POST /items": post, "DELETE /items": remove },
		});

		const notFound = await handle(new Request("https://api.test/missing"));
		const unsupported = await handle(new Request("https://api.test/items", { method: "PUT" }));
		const propertyNamedMethods = await Promise.all(
			["route", "serialization", "constructor", "__proto__", "toString"].map((method) =>
				handle(new Request("https://api.test/items", { method })),
			),
		);

		expect(notFound.status).toBe(404);
		expect(await notFound.json()).toEqual({ error: "not_found" });
		expect(unsupported.status).toBe(405);
		expect(unsupported.headers.get("allow")).toBe("DELETE, POST");
		expect(await unsupported.json()).toEqual({ error: "method_not_allowed" });
		for (const response of propertyNamedMethods) {
			expect(response.status).toBe(405);
			expect(response.headers.get("allow")).toBe("DELETE, POST");
			expect(await response.json()).toEqual({ error: "method_not_allowed" });
		}
		const inheritedGET = Object.getOwnPropertyDescriptor(Object.prototype, "GET");

		try {
			Object.defineProperty(Object.prototype, "GET", {
				configurable: true,
				value: { operationId: "inherited", responses: { 200: unknownSchema } },
			});

			const inherited = await handle(new Request("https://api.test/items"));

			expect(inherited.status).toBe(405);
			expect(inherited.headers.get("allow")).toBe("DELETE, POST");
			expect(await inherited.json()).toEqual({ error: "method_not_allowed" });
		} finally {
			if (inheritedGET) {
				Object.defineProperty(Object.prototype, "GET", inheritedGET);
			} else {
				Reflect.deleteProperty(Object.prototype, "GET");
			}
		}
		await expect(invalidHandle(new Request("https://api.test/missing"))).rejects.toMatchObject({
			name: "ProtocolError",
			method: "GET",
			status: 404,
		});
		await expect(invalidHandle(new Request("https://api.test/items", { method: "PUT" }))).rejects.toMatchObject({
			name: "ProtocolError",
			method: "PUT",
			status: 405,
		});
		expect(context).not.toHaveBeenCalled();
		expect(post).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});

	it("uses matching composed-operation 405 schemas and rejects conflicts deterministically", async () => {
		const parameter = route("/items/:id");
		const literal = route("/items/me");
		const shared = adapterResponse(
			schema<{ code: "method_not_allowed" }, { error: "method_not_allowed" }>((value) =>
				JSON.stringify(value) === '{"code":"method_not_allowed"}'
					? valid({ error: "method_not_allowed" })
					: invalid(),
			),
			() => ({ code: "method_not_allowed" }),
		);
		const conflicting = schema<{ code: "different" }>((value) =>
			JSON.stringify(value) === '{"code":"different"}' ? valid({ code: "different" }) : invalid(),
		);
		const global = adapterResponse(
			schema<{ code: "global" }, { error: "global" }>((value) =>
				JSON.stringify(value) === '{"code":"global"}' ? valid({ error: "global" }) : invalid(),
			),
			() => ({ code: "global" }),
		);
		const first = defineAPI({
			responses: { 400: defaultErrors[400], 405: shared },
			routes: {
				[parameter.path]: {
					route: parameter,
					serialization: "native",
					GET: { operationId: "parameter", responses: { 200: unknownSchema } },
				},
			},
		});
		const second = (common405: typeof shared | typeof conflicting) =>
			defineAPI({
				responses: { 405: common405 },
				routes: {
					[literal.path]: {
						route: literal,
						serialization: "native",
						POST: { operationId: "literal", responses: { 201: unknownSchema } },
					},
				},
			});
		const handlers = {
			"GET /items/:id": () => ({ status: 200 as const, body: null }),
			"POST /items/me": () => ({ status: 201 as const, body: null }),
		};
		const validHandle = createHandler(composeAPIs(first, second(shared)), {
			handlers,
		});
		const conflictingHandle = createHandler(composeAPIs(first, second(conflicting)), {
			handlers,
		});
		const globalHandle = createHandler(composeAPIs({ responses: { 405: global } }, first, second(conflicting)), {
			handlers,
		});

		const response = await validHandle(new Request("https://api.test/items/me", { method: "PATCH" }));

		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("GET, POST");
		expect(await response.json()).toEqual({ error: "method_not_allowed" });
		expect(
			await (await globalHandle(new Request("https://api.test/items/me", { method: "PATCH" }))).json(),
		).toEqual({
			error: "global",
		});
		await expect(
			conflictingHandle(new Request("https://api.test/items/me", { method: "PATCH" })),
		).rejects.toMatchObject({
			name: "ProtocolError",
			method: "PATCH",
			status: 405,
		});
	});

	it("treats inherited API-level response statuses as undeclared", async () => {
		const items = route("/items");
		const validate = vi.fn((value: unknown) => valid(value));
		const inherited = schema(validate);
		const responses = Object.create({ 404: inherited }) as Record<number, typeof inherited>;
		const api = defineAPI({
			responses,
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					GET: { operationId: "get", responses: { 200: unknownSchema } },
				},
			},
		});
		const handle = createHandler(api, {
			handlers: { "GET /items": () => ({ status: 404, body: { inherited: true } }) },
		} as never);

		await expect(handle(new Request("https://api.test/items"))).rejects.toMatchObject({
			name: "ProtocolError",
			method: "GET",
			path: items.path,
			status: 404,
			operationId: "get",
		});
		const missing = await handle(new Request("https://api.test/missing"));

		expect(await missing.json()).toEqual({ error: "not_found" });
		expect(validate).not.toHaveBeenCalled();
	});

	it("combines allowed methods from every overlapping route in stable order", async () => {
		const literal = route("/items/me");
		const parameter = route("/items/:id");
		const api = defineAPI({
			responses: { 400: defaultErrors[400] },
			routes: {
				[parameter.path]: {
					route: parameter,
					serialization: "native",
					POST: { operationId: "update", responses: { 200: unknownSchema } },
				},
				[literal.path]: {
					route: literal,
					serialization: "native",
					GET: { operationId: "read", responses: { 200: unknownSchema } },
				},
			},
		});
		const handle = createHandler(api, {
			handlers: {
				"POST /items/:id": () => ({ status: 200, body: null }),
				"GET /items/me": () => ({ status: 200, body: null }),
			},
		});
		const response = await handle(new Request("https://api.test/items/me", { method: "PATCH" }));

		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("GET, POST");
	});

	it("maps invalid route/search decoding to a declared 400", async () => {
		const item = route("/items/:id", {
			params: { id: codec.integer() },
			search: { page: codec.integer() },
		});
		const api = defineAPI({
			responses: { 400: defaultErrors[400] },
			routes: {
				[item.path]: {
					route: item,
					serialization: "native",
					GET: { operationId: "item", responses: { 200: unknownSchema } },
				},
			},
		});
		const handler = vi.fn(() => ({ status: 200 as const, body: null }));
		const handle = createHandler(api, { handlers: { "GET /items/:id": handler } });

		for (const href of [
			"https://api.test/items/not-an-integer?page=1",
			"https://api.test/items/1",
			"https://api.test/items/1?page=1&page=2",
			"https://api.test/items/%E0%A4%A?page=1",
		]) {
			const response = await handle(new Request(href));

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: "invalid_request" });
		}

		expect(handler).not.toHaveBeenCalled();
	});

	it("authorizes decoded input before reading a body and serializes typed rejection", async () => {
		const item = route("/organizations/:organizationId/items", {
			params: { organizationId: codec.integer() },
		});
		const unauthorized = schema<{ error: "unauthorized" }, { error: "unauthorized"; transformed: true }>(
			async (value) =>
				JSON.stringify(value) === '{"error":"unauthorized"}'
					? valid({ error: "unauthorized", transformed: true })
					: invalid(),
		);
		const api = defineAPI({
			responses: { ...defaultErrors, 401: unauthorized },
			routes: {
				[item.path]: {
					route: item,
					serialization: "native",
					POST: { operationId: "create", body: unknownSchema, responses: { 201: unknownSchema } },
				},
			},
		});
		let pulls = 0;
		let cancellations = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				++pulls;
				controller.enqueue(new TextEncoder().encode('{"secret":"never read"}'));
				controller.close();
			},
			cancel() {
				++cancellations;
			},
		});
		const handler = vi.fn(() => ({ status: 201 as const, body: null }));
		const handle = createHandler(api, {
			context: ({ method, path, params, respond }) => {
				expect(method).toBe("POST");
				expect(path).toBe("/organizations/:organizationId/items");
				expect(params.organizationId).toBe(42);

				return respond({ status: 401, body: { error: "unauthorized" as const } });
			},
			handlers: { "POST /organizations/:organizationId/items": handler },
		});
		const request = new Request("https://api.test/organizations/42/items", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
			duplex: "half",
		} as RequestInit);
		const response = await handle(request);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized", transformed: true });
		expect(pulls).toBeLessThanOrEqual(1);
		expect(cancellations).toBe(0);
		expect(request.bodyUsed).toBe(false);
		expect(handler).not.toHaveBeenCalled();
	});

	it("validates the same scoped rejection status through its selected component schema", async () => {
		const firstRoute = route("/first");
		const secondRoute = route("/second");
		const firstUnavailable = schema<{ source: "first" }, { error: "first_unavailable" }>((value) =>
			JSON.stringify(value) === '{"source":"first"}' ? valid({ error: "first_unavailable" }) : invalid(),
		);
		const secondUnavailable = schema<{ source: "second" }, { error: "second_unavailable" }>((value) =>
			JSON.stringify(value) === '{"source":"second"}' ? valid({ error: "second_unavailable" }) : invalid(),
		);
		const firstAPI = defineAPI({
			responses: { 503: firstUnavailable },
			routes: {
				[firstRoute.path]: {
					route: firstRoute,
					serialization: "native",
					GET: { operationId: "first", responses: { 200: unknownSchema } },
				},
			},
		});
		const secondAPI = defineAPI({
			responses: { 503: secondUnavailable },
			routes: {
				[secondRoute.path]: {
					route: secondRoute,
					serialization: "native",
					GET: { operationId: "second", responses: { 200: unknownSchema } },
				},
			},
		});
		const api = composeAPIs(firstAPI, secondAPI);
		const handlers = {
			"GET /first": () => ({ status: 200 as const, body: null }),
			"GET /second": () => ({ status: 200 as const, body: null }),
		};
		const handle = createHandler(api, {
			context: (input) =>
				input.path === firstRoute.path
					? input.respond({ status: 503, body: { source: "first" } })
					: input.respond({ status: 503, body: { source: "second" } }),
			handlers,
		});
		const invalidHandle = createHandler(api, {
			context: ({ respond }) =>
				(respond as unknown as (result: { status: number; body: unknown }) => never)({
					status: 503,
					body: { source: "second" },
				}),
			handlers,
		});

		expect(await (await handle(new Request("https://api.test/first"))).json()).toEqual({
			error: "first_unavailable",
		});
		expect(await (await handle(new Request("https://api.test/second"))).json()).toEqual({
			error: "second_unavailable",
		});
		await expect(invalidHandle(new Request("https://api.test/first"))).rejects.toMatchObject({
			name: "ProtocolError",
			method: "GET",
			path: "/first",
			status: 503,
			operationId: "first",
		});
	});

	it("distinguishes unsupported media, malformed JSON, and transformed input", async () => {
		const items = route("/items");
		const transformed = schema<{ value: string }, { value: number }>(async (value) => {
			const input = value as { value?: unknown };

			return typeof input?.value === "string" && /^\d+$/.test(input.value)
				? valid({ value: Number(input.value) })
				: invalid();
		});
		const api = defineAPI({
			responses: defaultErrors,
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					POST: { operationId: "create", body: transformed, responses: { 201: unknownSchema } },
				},
			},
		});
		const handler = vi.fn(({ body }) => ({ status: 201 as const, body }));
		const handle = createHandler(api, { handlers: { "POST /items": handler } });

		const unsupported = await handle(new Request("https://api.test/items", { method: "POST", body: "{}" }));
		const malformed = await handle(
			new Request("https://api.test/items", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{",
			}),
		);
		const validResponse = await handle(
			new Request("https://api.test/items", {
				method: "POST",
				headers: { "content-type": "application/problem+json; charset=utf-8" },
				body: '{"value":"42"}',
			}),
		);

		expect(unsupported.status).toBe(415);
		expect(await unsupported.json()).toEqual({ error: "unsupported_media_type" });
		expect(malformed.status).toBe(400);
		expect(await malformed.json()).toEqual({ error: "invalid_request" });
		expect(validResponse.status).toBe(201);
		expect(await validResponse.json()).toEqual({ value: 42 });
		expect(handler).toHaveBeenCalledOnce();
	});

	it("enforces declared and streamed byte limits and cancels oversized streams", async () => {
		const items = route("/items");
		const api = defineAPI({
			responses: defaultErrors,
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					POST: { operationId: "create", body: unknownSchema, responses: { 201: unknownSchema } },
				},
			},
		});
		const handler = vi.fn(() => ({ status: 201 as const, body: null }));
		const handle = createHandler(api, { maxBodyBytes: 8, handlers: { "POST /items": handler } });
		let declaredCancelled = 0;
		const declaredBody = new ReadableStream<Uint8Array>({
			cancel() {
				++declaredCancelled;
			},
		});
		const declared = await handle(
			new Request("https://api.test/items", {
				method: "POST",
				headers: { "content-length": "100", "content-type": "application/json" },
				body: declaredBody,
				duplex: "half",
			} as RequestInit),
		);
		let streamedCancelled = 0;
		let pulls = 0;
		const streamedBody = new ReadableStream<Uint8Array>({
			pull(controller) {
				++pulls;
				controller.enqueue(new Uint8Array(6));
			},
			cancel() {
				++streamedCancelled;
			},
		});
		const streamed = await handle(
			new Request("https://api.test/items", {
				method: "POST",
				headers: { "content-length": "1", "content-type": "application/json" },
				body: streamedBody,
				duplex: "half",
			} as RequestInit),
		);

		expect(declared.status).toBe(413);
		expect(declaredCancelled).toBe(1);
		expect(streamed.status).toBe(413);
		expect(streamedCancelled).toBe(1);
		expect(pulls).toBeLessThanOrEqual(3);
		expect(handler).not.toHaveBeenCalled();
	});

	it("validates configured adapter bodies when their status is declared", async () => {
		const items = route("/items");
		const customError = schema<{ code: "bad_json" }>((value) =>
			JSON.stringify(value) === '{"code":"bad_json"}' ? valid(value as { code: "bad_json" }) : invalid(),
		);
		const api = defineAPI({
			responses: { ...defaultErrors, 400: adapterResponse(customError, () => ({ code: "bad_json" })) },
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					POST: { operationId: "create", body: unknownSchema, responses: { 201: unknownSchema } },
				},
			},
		});
		const request = new Request("https://api.test/items", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{",
		});
		const validHandle = createHandler(api, {
			handlers: { "POST /items": () => ({ status: 201, body: null }) },
		});
		const invalidAPI = defineAPI({
			...api,
			responses: {
				...api.responses,
				400: adapterResponse(customError, () => ({ code: "wrong" }) as never),
			},
		});
		const invalidHandle = createHandler(invalidAPI, {
			handlers: { "POST /items": () => ({ status: 201, body: null }) },
		});

		expect(await (await validHandle(request.clone())).json()).toEqual({ code: "bad_json" });
		await expect(invalidHandle(request)).rejects.toMatchObject({
			name: "ProtocolError",
			method: "POST",
			path: "/items",
			status: 400,
			operationId: "create",
		});
	});

	it("materializes applicable adapter responses before serving requests", async () => {
		const items = route("/items");
		const api = defineAPI({
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					POST: { operationId: "create", body: unknownSchema, responses: { 201: unknownSchema } },
				},
			},
		});
		expect(Object.keys(api.routes[items.path].POST.responses)).toEqual(["201", "400", "413", "415"]);
		const handle = createHandler(api, {
			handlers: { "POST /items": () => ({ status: 201, body: null }) },
		});
		const response = await handle(new Request("https://api.test/items", { method: "POST", body: "null" }));
		expect(response.status).toBe(415);
		expect(await response.json()).toEqual({ error: "unsupported_media_type" });

		for (const selected of [
			route("/items/:id"),
			route("/items", { search: { page: codec.integer().optional() } }),
		]) {
			const incomplete = defineAPI({
				routes: {
					[selected.path]: {
						route: selected,
						GET: { operationId: "read", responses: { 200: unknownSchema } },
					},
				},
			});
			expect(Object.keys(incomplete.routes[selected.path]!.GET.responses)).toEqual(["200", "400"]);
		}
	});

	it("awaits response transforms, supports API-level outcomes, and emits true no-content responses", async () => {
		const item = route("/items/:id", { params: { id: codec.integer() } });
		const output = schema<{ id: number; private: string }, { id: string }>(async (value) => {
			const record = value as { id?: unknown };

			return typeof record.id === "number" ? valid({ id: String(record.id) }) : invalid();
		});
		const missing = schema<{ error: "not_found" }>((value) => valid(value as { error: "not_found" }));
		const api = defineAPI({
			responses: { 400: defaultErrors[400], 404: missing },
			routes: {
				[item.path]: {
					route: item,
					serialization: "native",
					GET: { operationId: "get", responses: { 200: output } },
					DELETE: { operationId: "delete", responses: { 204: null } },
				},
			},
		});
		const getHandle = createHandler(api, {
			handlers: {
				"GET /items/:id": ({ params }) =>
					params.id === 1
						? { status: 200, body: { id: 1, private: "removed by transform" } }
						: { status: 404, body: { error: "not_found" } },
				"DELETE /items/:id": () => ({ status: 204 }),
			},
		});

		const found = await getHandle(new Request("https://api.test/items/1"));
		const notFound = await getHandle(new Request("https://api.test/items/2"));
		const removed = await getHandle(new Request("https://api.test/items/1", { method: "DELETE" }));

		expect(await found.json()).toEqual({ id: "1" });
		expect(await notFound.json()).toEqual({ error: "not_found" });
		expect(removed.status).toBe(204);
		expect(removed.headers.has("content-type")).toBe(false);
		expect(await removed.text()).toBe("");
	});

	it("rejects undeclared, invalid, omitted, and non-JSON-safe handler output without leaking issues", async () => {
		const items = route("/items");
		const response = schema<unknown>((value) => (value === "valid" ? valid(value) : invalid("secret-value-42")));
		const api = defineAPI({
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					GET: { operationId: "list", responses: { 200: response } },
				},
			},
		});

		for (const result of [
			{ status: 201, body: "valid" },
			{ status: 200, body: "secret-value-42" },
			{ status: 200 },
			{ status: 200, body: new Date() },
		]) {
			const handle = createHandler(api, {
				handlers: { "GET /items": () => result as never },
			});

			await expect(handle(new Request("https://api.test/items"))).rejects.toSatisfy((error: ProtocolError) => {
				expect(error).toBeInstanceOf(ProtocolError);
				expect(error.message).not.toContain("secret-value-42");
				expect(error).toMatchObject({ method: "GET", path: "/items", operationId: "list" });

				return true;
			});
		}
	});

	it("propagates unexpected context, handler, and validator exceptions unchanged", async () => {
		const items = route("/items");
		const contextError = new Error("context failed");
		const handlerError = new Error("handler failed");
		const validatorError = new Error("validator failed");
		const throwingBody = schema<unknown>(() => {
			throw validatorError;
		});
		const contextAPI = defineAPI({
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					GET: { operationId: "context", responses: { 200: unknownSchema } },
				},
			},
		});
		const handlerAPI = defineAPI({
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					GET: { operationId: "handler", responses: { 200: unknownSchema } },
				},
			},
		});
		const validatorAPI = defineAPI({
			responses: defaultErrors,
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					POST: { operationId: "validator", body: throwingBody, responses: { 200: unknownSchema } },
				},
			},
		});
		const contextHandle = createHandler(contextAPI, {
			context: () => {
				throw contextError;
			},
			handlers: { "GET /items": () => ({ status: 200, body: null }) },
		});
		const handlerHandle = createHandler(handlerAPI, {
			handlers: {
				"GET /items": () => {
					throw handlerError;
				},
			},
		});
		const validatorHandle = createHandler(validatorAPI, {
			handlers: { "POST /items": () => ({ status: 200, body: null }) },
		});

		await expect(contextHandle(new Request("https://api.test/items"))).rejects.toBe(contextError);
		await expect(handlerHandle(new Request("https://api.test/items"))).rejects.toBe(handlerError);
		await expect(
			validatorHandle(
				new Request("https://api.test/items", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: "null",
				}),
			),
		).rejects.toBe(validatorError);
	});

	it("validates handler configuration without reading requests", async () => {
		const items = route("/items");
		const api = defineAPI({
			routes: {
				[items.path]: {
					route: items,
					serialization: "native",
					GET: { operationId: "list", responses: { 200: unknownSchema } },
				},
			},
		});

		for (const maxBodyBytes of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
			expect(() =>
				createHandler(api, {
					maxBodyBytes,
					handlers: { "GET /items": () => ({ status: 200, body: null }) },
				}),
			).toThrowError(ProtocolError);
		}

		expect(() => createHandler(api, { handlers: {} as never })).toThrowError(ProtocolError);

		const invalidResponse = createHandler(api, {
			context: ({ respond }) => (respond as unknown as (result: unknown) => never)({ status: 99, body: null }),
			handlers: { "GET /items": () => ({ status: 200, body: null }) },
		});

		await expect(invalidResponse(new Request("https://api.test/items"))).rejects.toThrowError(ProtocolError);
	});
});
