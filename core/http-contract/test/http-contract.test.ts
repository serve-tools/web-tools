import { codec, route } from "@serve-tools/router";
import { describe, expect, it, vi } from "vitest";
import type { API, Schema } from "../src/http-contract.js";
import { defineAPI, ProtocolError } from "../src/http-contract.js";

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
	it("preserves the executable contract and literal declarations", () => {
		const notes = route("/organizations/:organizationId/notes", {
			params: { organizationId: codec.integer() },
		});
		const contract = {
			commonResponses: { 401: json },
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

		expect(defineAPI(contract)).toBe(contract);
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

	it("restricts common responses and permits only identity-equal status overlaps", () => {
		expect(() =>
			defineAPI({
				commonResponses: { 200: json },
				routes: {
					[home.path]: {
						route: home,
						serialization: "native",
						GET: { operationId: "get", responses: { 200: json } },
					},
				},
			} as never),
		).toThrowError(/Common responses must use 4xx or 5xx/);

		const common = schema((value) => ({ value }));
		const same = {
			commonResponses: { 400: common },
			routes: {
				[home.path]: {
					route: home,
					serialization: "native",
					GET: { operationId: "get", responses: { 200: json, 400: common } },
				},
			},
		} as const;

		expect(defineAPI(same)).toBe(same);
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
		).toThrowError(/share the same schema/);
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
	});

	it("treats prototype-sensitive parameter names and response maps as own data", () => {
		const special = route("/values/:__proto__/:constructor/:toString/:hasOwnProperty");
		const common = Object.assign(Object.create(null), { 400: json }) as { readonly 400: typeof json };
		const contract = defineAPI({
			commonResponses: common,
			routes: {
				[special.path]: {
					route: special,
					serialization: "native",
					GET: { operationId: "special", responses: { 200: json } },
				},
			},
		});

		expect(contract.routes[special.path].route).toBe(special);
		expect(Object.hasOwn(contract.commonResponses, 400)).toBe(true);
		expect(Object.prototype).not.toHaveProperty("polluted");
	});
});

describe("ProtocolError", () => {
	it("retains only safe protocol metadata and an optional cause", () => {
		const cause = new TypeError("validator failed");
		const error = new ProtocolError("Invalid declared response", {
			method: "POST",
			path: "/notes",
			status: 201,
			operationId: "createNote",
			cause,
		});

		expect(error).toMatchObject({
			name: "ProtocolError",
			message: "Invalid declared response",
			method: "POST",
			path: "/notes",
			status: 201,
			operationId: "createNote",
			cause,
		});
	});
});
