import { codec, route } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it, vi } from "vitest";

import { defineAPI, ProtocolError } from "../src/http-contract.js";
import { assertJSONValue, isJSONMediaType } from "../src/lib/json.js";
import { createHandler, reject } from "../src/server.js";

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
			commonResponses: defaultErrors,
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

	it("uses complete left-to-right specificity independent of registration order", async () => {
		const earlyLiteral = route("/a/x/:value");
		const lateLiteral = route("/a/:id/b");
		const api = defineAPI({
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
		});
		const handle = createHandler(api, {
			handlers: {
				"GET /a/:id/b": () => ({ status: 200, body: "late" }),
				"GET /a/x/:value": () => ({ status: 200, body: "early" }),
			},
		});

		expect(await (await handle(new Request("https://api.test/a/x/b"))).json()).toBe("early");
	});

	it("preserves encoded literal matching while selecting literal routes over parameters", async () => {
		const literal = route("/café/résumé");
		const parameter = route("/café/:name");
		const api = defineAPI({
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
		const api = defineAPI({
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

		expect(() =>
			createHandler(api, {
				handlers: {
					"GET /users/:id": () => ({ status: 200, body: null }),
					"GET /users/:name": () => ({ status: 200, body: null }),
				},
			}),
		).toThrowError(ProtocolError);
	});

	it("returns safe 404 and stable 405 responses without invoking application code", async () => {
		const items = route("/items");
		const api = defineAPI({
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

		const missing = await handle(new Request("https://api.test/missing"));
		const unsupported = await handle(new Request("https://api.test/items", { method: "PUT" }));

		expect(missing.status).toBe(404);
		expect(await missing.json()).toEqual({ error: "not_found" });
		expect(unsupported.status).toBe(405);
		expect(unsupported.headers.get("allow")).toBe("DELETE, POST");
		expect(await unsupported.json()).toEqual({ error: "method_not_allowed" });
		expect(context).not.toHaveBeenCalled();
		expect(post).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});

	it("combines allowed methods from every overlapping route in stable order", async () => {
		const literal = route("/items/me");
		const parameter = route("/items/:id");
		const api = defineAPI({
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
			commonResponses: { 400: defaultErrors[400] },
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
			commonResponses: { 401: unauthorized },
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
			context: ({ params }) => {
				expect(params.organizationId).toBe(42);

				return reject(401, { error: "unauthorized" as const });
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

	it("distinguishes unsupported media, malformed JSON, and transformed input", async () => {
		const items = route("/items");
		const transformed = schema<{ value: string }, { value: number }>(async (value) => {
			const input = value as { value?: unknown };

			return typeof input?.value === "string" && /^\d+$/.test(input.value)
				? valid({ value: Number(input.value) })
				: invalid();
		});
		const api = defineAPI({
			commonResponses: { 400: defaultErrors[400], 415: defaultErrors[415] },
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
			commonResponses: { 413: defaultErrors[413] },
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
			commonResponses: { 400: customError },
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
			errorBodies: { 400: () => ({ code: "bad_json" }) },
			handlers: { "POST /items": () => ({ status: 201, body: null }) },
		});
		const invalidHandle = createHandler(api, {
			errorBodies: { 400: () => ({ code: "wrong" }) },
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

	it("awaits response transforms, supports common outcomes, and emits true no-content responses", async () => {
		const item = route("/items/:id", { params: { id: codec.integer() } });
		const output = schema<{ id: number; private: string }, { id: string }>(async (value) => {
			const record = value as { id?: unknown };

			return typeof record.id === "number" ? valid({ id: String(record.id) }) : invalid();
		});
		const missing = schema<{ error: "not_found" }>((value) => valid(value as { error: "not_found" }));
		const api = defineAPI({
			commonResponses: { 404: missing },
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

	it("validates handler configuration without reading requests", () => {
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

		expect(() => reject(99, null)).toThrowError(ProtocolError);
	});
});
