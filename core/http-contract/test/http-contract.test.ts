import { codec, route } from "@serve-tools/router";
import { describe, expect, it, vi } from "vitest";
import type { API, Schema } from "../src/http-contract.js";
import { composeAPIs, defineAPI, ProtocolError } from "../src/http-contract.js";
import { createHandler } from "../src/server.js";

function schema<Input = unknown, Output = Input>(
	validate: (
		value: unknown,
	) => { readonly value: Output } | { readonly issues: readonly { readonly message: string }[] },
): Schema<Input, Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "http-contract-test",
			validate,
			types: undefined as never,
		},
	};
}

const json = schema((value) => ({ value }));
const home = route("/");

function api(operation: Record<PropertyKey, unknown>): API {
	return {
		routes: {
			[home.path]: {
				route: home,
				serialization: "native",
				GET: operation,
			},
		},
	} as unknown as API;
}

describe("defineAPI", () => {
	it("defaults to native serialization without weakening custom-codec checks", () => {
		const contract = {
			routes: { [home.path]: { route: home, GET: { operationId: "home", responses: { 200: json } } } },
		};

		expect(defineAPI(contract).routes[home.path].serialization).toBe("native");
		expect(contract.routes[home.path]).not.toHaveProperty("serialization");
		const custom = route("/custom/:id", {
			params: { id: codec.schema({ parse: Number, format: String }) },
		});
		expect(() =>
			defineAPI({
				routes: { [custom.path]: { route: custom, GET: { operationId: "custom", responses: { 200: json } } } },
			}),
		).toThrowError(/Custom router codecs require serialization/);
	});

	it("rejects route shadowing unless native codecs prove the wire paths disjoint", () => {
		for (const [parameter, literal, serialization, overlaps] of [
			[route("/items/:id"), route("/items/me"), "native", true],
			[route("/items/:id", { params: { id: codec.integer() } }), route("/items/me"), "native", false],
			[route("/items/:id", { params: { id: codec.integer() } }), route("/items/42"), "native", true],
			[route("/items/:id", { params: { id: codec.integer() } }), route("/items/me"), "href", true],
			[route("/items/:id", { params: { id: codec.enum("other") } }), route("/items/me"), "native", false],
			[route("/items/:id", { params: { id: codec.enum("me", "other") } }), route("/items/me"), "native", true],
			[route("/items/:id", { params: { id: codec.enum("café") } }), route("/items/café"), "native", true],
		] as const) {
			const contract = {
				responses: { 400: json },
				routes: {
					[parameter.path]: {
						route: parameter,
						serialization,
						GET: { operationId: "parameter", responses: { 200: json } },
					},
					[literal.path]: {
						route: literal,
						GET: { operationId: "literal", responses: { 200: json } },
					},
				},
			};

			if (overlaps) {
				expect(() => defineAPI(contract)).toThrowError(/Ambiguous HTTP route templates/);
				expect(() => createHandler(contract, { handlers: {} as never })).toThrowError(
					/Ambiguous HTTP route templates/,
				);
			} else {
				expect(() => defineAPI(contract)).not.toThrow();
			}
		}
	});

	it("preserves the executable contract and literal declarations", () => {
		const notes = route("/organizations/:organizationId/notes", {
			params: { organizationId: codec.integer() },
		});
		const contract = {
			responses: { 401: json },
			routes: {
				[notes.path]: {
					route: notes,
					serialization: "native",
					POST: {
						operationId: "createNote",
						body: json,
						responses: { 201: json },
					},
				},
			},
		} as const;

		const normalized = defineAPI(contract);
		expect(normalized.routes[notes.path].route).toBe(notes);
		expect(normalized.routes[notes.path].POST.body).toBe(json);
		expect(normalized.routes[notes.path].POST.operationId).toBe("createNote");
		expect(Object.keys(normalized.routes[notes.path].POST.responses)).toEqual(["201", "400", "413", "415"]);
		expect(Object.keys(contract.routes[notes.path].POST.responses)).toEqual(["201"]);
	});

	it("accepts synchronous and asynchronous vendor-neutral Standard Schemas without invoking them", () => {
		const syncValidate = vi.fn((value: unknown) => ({ value }));
		const asyncValidate = vi.fn(async (value: unknown) => ({ value }));
		const syncSchema = schema(syncValidate);
		const asyncSchema: Schema = {
			"~standard": {
				version: 1,
				vendor: "async-test",
				validate: asyncValidate,
			},
		};

		defineAPI({
			routes: {
				[home.path]: {
					route: home,
					serialization: "native",
					POST: {
						operationId: "create",
						body: syncSchema,
						responses: { 201: asyncSchema },
					},
				},
			},
		});

		expect(syncValidate).not.toHaveBeenCalled();
		expect(asyncValidate).not.toHaveBeenCalled();
	});

	it("rejects empty APIs, empty routes, unsupported properties, and key/path mismatches", () => {
		expect(() => defineAPI({ routes: {} })).toThrowError(/at least one route/);
		expect(() => defineAPI({ routes: {}, extra: true } as never)).toThrowError(/unsupported property/);
		expect(() =>
			defineAPI({ routes: { [home.path]: { route: home, serialization: "native" } } } as never),
		).toThrowError(/at least one supported HTTP method/);
		expect(() =>
			defineAPI({
				routes: {
					[home.path]: {
						route: home,
						serialization: "native",
						HEAD: { operationId: "head", responses: { 200: json } },
					},
				},
			} as never),
		).toThrowError(/unsupported HTTP method or property/);
		expect(() =>
			defineAPI({
				routes: {
					"/other": {
						route: home,
						serialization: "native",
						GET: { operationId: "get", responses: { 200: json } },
					},
				},
			} as never),
		).toThrowError(/key must equal its route path/);
		expect(() =>
			defineAPI(api({ operationId: "get", responses: { 200: json }, typo: true }) as never),
		).toThrowError(/operation contains an unsupported property/);
	});

	it("rejects the removed commonResponses property instead of ignoring it", () => {
		const routes = {
			[home.path]: {
				route: home,
				serialization: "native",
				GET: { operationId: "get", responses: { 200: json } },
			},
		} as const;

		expect(() => defineAPI({ commonResponses: { 400: json }, routes } as never)).toThrow();
		expect(() =>
			defineAPI({ responses: { 400: json }, commonResponses: { 401: json }, routes } as never),
		).toThrow();

		const component = defineAPI({ routes });
		expect(() => composeAPIs({ commonResponses: { 400: json } } as never, component)).toThrow();
		expect(() =>
			composeAPIs({ responses: { 400: json }, commonResponses: { 401: json } } as never, component),
		).toThrow();
	});

	it("rejects duplicate operation IDs and GET request bodies", () => {
		const first = route("/first");
		const second = route("/second");

		expect(() =>
			defineAPI({
				routes: {
					[first.path]: {
						route: first,
						serialization: "native",
						GET: { operationId: "duplicate", responses: { 200: json } },
					},
					[second.path]: {
						route: second,
						serialization: "native",
						POST: { operationId: "duplicate", responses: { 201: json } },
					},
				},
			}),
		).toThrowError(/operationId must be unique/);
		expect(() =>
			defineAPI(api({ operationId: "get", body: json, responses: { 200: json } }) as never),
		).toThrowError(/GET operations cannot declare/);
		expect(() =>
			defineAPI(api({ operationId: "get", body: undefined, responses: { 200: json } }) as never),
		).toThrowError(/GET operations cannot declare/);
	});

	it("rejects same-method ambiguous route templates while allowing disjoint methods", () => {
		const first = route("/users/:id");
		const second = route("/users/:name");
		const ambiguous = {
			routes: {
				[first.path]: {
					route: first,
					serialization: "native",
					GET: { operationId: "getById", responses: { 200: json } },
				},
				[second.path]: {
					route: second,
					serialization: "native",
					GET: { operationId: "getByName", responses: { 200: json } },
				},
			},
		} as const;

		expect(() => defineAPI(ambiguous)).toThrowError(
			expect.objectContaining({
				message: expect.stringMatching(/Ambiguous HTTP route templates/),
				method: "GET",
				path: first.path,
			}),
		);
		expect(
			defineAPI({
				routes: {
					[first.path]: ambiguous.routes[first.path],
					[second.path]: {
						route: second,
						serialization: "native",
						POST: { operationId: "updateByName", responses: { 200: json } },
					},
				},
			}),
		).toBeDefined();
	});

	it("accepts every supported method and rejects malformed schemas without calling vendor APIs", () => {
		const supported = route("/supported");
		const responses = { 200: json };

		expect(
			defineAPI({
				routes: {
					[supported.path]: {
						route: supported,
						serialization: "native",
						DELETE: { operationId: "delete", responses },
						GET: { operationId: "get", responses },
						PATCH: { operationId: "patch", responses },
						POST: { operationId: "post", responses },
						PUT: { operationId: "put", responses },
					},
				},
			}),
		).toBeDefined();
		expect(() => defineAPI(api({ operationId: "invalid-response", responses: { 200: {} } }) as never)).toThrowError(
			/Standard Schema version 1/,
		);
	});

	it("enforces response status classes, successful outcomes, and no-content markers", () => {
		expect(() => defineAPI(api({ operationId: "redirect", responses: { 302: json } }) as never)).toThrowError(
			/explicit 2xx, 4xx, or 5xx/,
		);
		expect(() => defineAPI(api({ operationId: "failure", responses: { 400: json } }) as never)).toThrowError(
			/at least one successful 2xx/,
		);
		expect(() => defineAPI(api({ operationId: "empty", responses: { 204: json } }) as never)).toThrowError(
			/204 or 205 must use the null/,
		);
		expect(() => defineAPI(api({ operationId: "json", responses: { 200: null } }) as never)).toThrowError(
			/null no-content marker is valid only/,
		);

		expect(defineAPI(api({ operationId: "delete", responses: { 204: null, 404: json } }) as never)).toBeDefined();
	});

	it("restricts API-level responses and permits only identity-equal status overlaps", () => {
		expect(() =>
			defineAPI({
				responses: { 200: json },
				routes: {
					[home.path]: {
						route: home,
						serialization: "native",
						GET: { operationId: "get", responses: { 200: json } },
					},
				},
			} as never),
		).toThrowError("API-level responses must use 4xx or 5xx statuses");

		const sharedResponse = schema((value) => ({ value }));
		const same = {
			responses: { 400: sharedResponse },
			routes: {
				[home.path]: {
					route: home,
					serialization: "native",
					GET: { operationId: "get", responses: { 200: json, 400: sharedResponse } },
				},
			},
		} as const;

		expect(defineAPI(same)).toStrictEqual(same);
		expect(() =>
			defineAPI({
				...same,
				routes: {
					[home.path]: {
						...same.routes[home.path],
						GET: {
							...same.routes[home.path].GET,
							responses: { 200: json, 400: schema((value) => ({ value })) },
						},
					},
				},
			}),
		).toThrowError("API-level and operation responses may overlap only when they share the same schema");
	});

	it("rejects affixed parameter templates while accepting href serialization", () => {
		const affixed = route("/assets/:id.:format");
		const dotSegment = route("/notes/../admin");
		const custom = route("/custom/:value", {
			params: {
				value: codec.schema({
					parse: (value) => value.toUpperCase(),
					format: (value) => value,
				}),
			},
		});

		expect(() =>
			defineAPI({
				routes: {
					[affixed.path]: {
						route: affixed,
						serialization: "native",
						GET: { operationId: "asset", responses: { 200: json } },
					},
				},
			}),
		).toThrowError(/complete literal or :parameter segments/);
		expect(() =>
			defineAPI({
				routes: {
					[dotSegment.path]: {
						route: dotSegment,
						serialization: "native",
						GET: { operationId: "dotSegment", responses: { 200: json } },
					},
				},
			}),
		).toThrowError(/complete literal or :parameter segments/);

		expect(
			defineAPI({
				routes: {
					[custom.path]: {
						route: custom,
						serialization: "href",
						GET: { operationId: "custom", responses: { 200: json } },
					},
				},
			}),
		).toBeDefined();
		expect(() =>
			defineAPI({
				routes: {
					[custom.path]: {
						route: custom,
						serialization: "native",
						GET: { operationId: "nativeCustom", responses: { 200: json } },
					},
				},
			}),
		).toThrowError(/Custom router codecs require serialization: "href"/);
	});

	it("treats prototype-sensitive parameter names and response maps as own data", () => {
		const special = route("/values/:__proto__/:constructor/:toString/:hasOwnProperty");
		const apiResponses = Object.assign(Object.create(null), { 400: json }) as { readonly 400: typeof json };
		const contract = defineAPI({
			responses: apiResponses,
			routes: {
				[special.path]: {
					route: special,
					serialization: "native",
					GET: { operationId: "special", responses: { 200: json } },
				},
			},
		});

		expect(contract.routes[special.path].route).toBe(special);
		expect(Object.hasOwn(contract.responses, 400)).toBe(true);
		expect(Object.prototype).not.toHaveProperty("polluted");
	});
});

describe("composeAPIs", () => {
	it("materializes API-level responses only into their component operations without mutating inputs", async () => {
		const database = route("/database");
		const document = route("/openapi.json");
		const unavailable = schema((value) => ({ value }));
		const databaseAPI = defineAPI({
			responses: { 503: unavailable },
			routes: {
				[database.path]: {
					route: database,
					serialization: "native",
					GET: { operationId: "getDatabase", responses: { 200: json } },
				},
			},
		});
		const documentAPI = defineAPI({
			routes: {
				[document.path]: {
					route: document,
					serialization: "native",
					GET: { operationId: "getOpenAPIDocument", responses: { 200: json } },
				},
			},
		});
		const composed = composeAPIs(databaseAPI, documentAPI);

		expect(Object.hasOwn(composed, "responses")).toBe(false);
		expect(composed.routes[database.path].GET?.responses).toEqual({ 200: json, 503: unavailable });
		expect(composed.routes[document.path].GET?.responses).toEqual({ 200: json });
		expect(composed.routes[database.path]).not.toBe(databaseAPI.routes[database.path]);
		expect(composed.routes[database.path].GET).not.toBe(databaseAPI.routes[database.path].GET);
		expect(databaseAPI.routes[database.path].GET.responses).toEqual({ 200: json });
		expect(databaseAPI.responses).toEqual({ 503: unavailable });

		const handle = createHandler(composed, {
			handlers: {
				"GET /database": () => ({ status: 503, body: { error: "unavailable" } }),
				"GET /openapi.json": () => ({ status: 200, body: { openapi: "3.1.0" } }),
			},
		});

		expect((await handle(new Request("https://api.test/database"))).status).toBe(503);
		expect((await handle(new Request("https://api.test/openapi.json"))).status).toBe(200);
	});

	it("rejects exact route-path collisions and duplicate operation IDs across components", () => {
		const shared = route("/shared");
		const first = defineAPI({
			routes: {
				[shared.path]: {
					route: shared,
					serialization: "native",
					GET: { operationId: "first", responses: { 200: json } },
				},
			},
		});
		const second = defineAPI({
			routes: {
				[shared.path]: {
					route: shared,
					serialization: "native",
					POST: { operationId: "second", responses: { 201: json } },
				},
			},
		});
		const widenedFirst: API = first;
		const widenedSecond: API = second;

		expect(() => composeAPIs(widenedFirst, widenedSecond)).toThrowError(
			expect.objectContaining({ message: expect.stringMatching(/distinct route paths/), path: shared.path }),
		);

		const other = route("/other");
		const duplicateOperation = defineAPI({
			routes: {
				[other.path]: {
					route: other,
					serialization: "native",
					GET: { operationId: "first", responses: { 200: json } },
				},
			},
		});

		expect(() => composeAPIs(first, duplicateOperation)).toThrowError(/operationId must be unique/);
	});

	it("retains explicit final API-level responses without widening component scopes", () => {
		const database = route("/database");
		const status = route("/status");
		const unauthorized = schema((value) => ({ value }));
		const unavailable = schema((value) => ({ value }));
		const databaseAPI = defineAPI({
			responses: { 503: unavailable },
			routes: {
				[database.path]: {
					route: database,
					serialization: "native",
					GET: { operationId: "getDatabase", responses: { 200: json } },
				},
			},
		});
		const statusAPI = defineAPI({
			routes: {
				[status.path]: {
					route: status,
					serialization: "native",
					GET: { operationId: "getStatus", responses: { 200: json } },
				},
			},
		});
		const composed = composeAPIs({ responses: { 401: unauthorized } }, databaseAPI, statusAPI);

		expect(composed.responses).toEqual({ 401: unauthorized });
		expect(composed.routes[database.path].GET?.responses).toEqual({ 200: json, 503: unavailable });
		expect(composed.routes[status.path].GET?.responses).toEqual({ 200: json });
		expect(databaseAPI.routes[database.path].GET.responses).toEqual({ 200: json });
		expect(statusAPI.routes[status.path].GET.responses).toEqual({ 200: json });

		const globalUnavailable = schema((value) => ({ value }));
		const globallyOverridden = composeAPIs({ responses: { 503: globalUnavailable } }, databaseAPI, statusAPI);

		expect(globallyOverridden.responses[503]).toBe(globalUnavailable);
		expect(globallyOverridden.routes[database.path].GET?.responses).toEqual({ 200: json });
	});
});

describe("ProtocolError", () => {
	it("retains safe protocol metadata, the original response, and an optional cause", () => {
		const cause = new TypeError("validator failed");
		const response = new Response("invalid", { status: 201 });
		const error = new ProtocolError("Invalid declared response", {
			method: "POST",
			path: "/notes",
			status: 201,
			operationId: "createNote",
			response,
			cause,
		});

		expect(error).toMatchObject({
			name: "ProtocolError",
			message: "Invalid declared response",
			method: "POST",
			path: "/notes",
			status: 201,
			operationId: "createNote",
			response,
			cause,
		});
	});
});
