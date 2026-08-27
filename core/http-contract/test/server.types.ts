import { codec, route } from "@serve-tools/router";
import type { Schema } from "../src/http-contract.js";
import { composeAPIs, defineAPI } from "../src/http-contract.js";
import type { ContextInput, ContextResponse, CreateHandlerOptions } from "../src/server.js";

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

function schema<Input>(): Schema<Input> {
	return {
		"~standard": {
			version: 1,
			vendor: "server-type-test",
			validate: (value) => ({ value: value as Input }),
			types: undefined as never,
		},
	};
}

const item = route("/items/:id", { params: { id: codec.integer() } });
const audit = route("/audit", { search: { cursor: codec.string().optional() } });

const unauthorized = schema<{ error: "unauthorized" }>();
const itemOutput = schema<{ id: number }>();
const missing = schema<{ error: "not_found" }>();
const conflict = schema<{ error: "conflict"; field: "name" }>();
const forbidden = schema<{ error: "forbidden" }>();

const api = defineAPI({
	responses: { "401": unauthorized },
	routes: {
		[item.path]: {
			route: item,
			serialization: "native",
			GET: { operationId: "getItem", responses: { "200": itemOutput, "404": missing } },
			POST: {
				operationId: "replaceItem",
				body: itemOutput,
				responses: { "201": itemOutput, "409": conflict },
			},
			DELETE: { operationId: "deleteItem", responses: { "204": null } },
		},
		[audit.path]: {
			route: audit,
			serialization: "native",
			GET: { operationId: "getAudit", responses: { "200": itemOutput, "403": forbidden } },
		},
	},
});

type Input = ContextInput<typeof api>;
type GetItemInput = Extract<Input, { readonly method: "GET"; readonly path: typeof item.path }>;
type ReplaceItemInput = Extract<Input, { readonly method: "POST"; readonly path: typeof item.path }>;
type GetAuditInput = Extract<Input, { readonly method: "GET"; readonly path: typeof audit.path }>;

export type ContextDiscrimination = [
	Expect<Equal<GetItemInput["method"], "GET">>,
	Expect<Equal<GetItemInput["path"], "/items/:id">>,
	Expect<Equal<GetItemInput["params"], { id: number }>>,
	Expect<Equal<ReplaceItemInput["method"], "POST">>,
	Expect<Equal<GetAuditInput["search"], { cursor: string | undefined }>>,
];

type ApplicationContext = { readonly actor: string };
type ContextHook = NonNullable<CreateHandlerOptions<typeof api, ApplicationContext>["context"]>;

export const context: ContextHook = async (input) => {
	input.respond({ status: 401, body: { error: "unauthorized" } });
	input.respond({ status: 401, body: { error: "unauthorized" }, headers: { "WWW-Authenticate": "Bearer" } });
	// @ts-expect-error response metadata must use native HeadersInit
	input.respond({ status: 401, body: { error: "unauthorized" }, headers: 42 });

	if (input.method === "GET" && input.path === item.path) {
		const id: number = input.params.id;

		input.respond({ status: 401, body: { error: "unauthorized" } });
		input.respond({ status: 404, body: { error: "not_found" } });
		input.respond({ status: 200, body: { id } });

		// @ts-expect-error 409 belongs to POST /items/:id, not this GET operation
		input.respond({ status: 409, body: { error: "conflict", field: "name" } });
		// @ts-expect-error 403 is declared elsewhere and cannot end this operation
		input.respond({ status: 403, body: { error: "forbidden" } });
		// @ts-expect-error status and response body must come from the same declared response
		input.respond({ status: 404, body: { error: "unauthorized" } });
		// @ts-expect-error a JSON response requires its body
		input.respond({ status: 404 });
	}

	if (input.method === "POST" && input.path === item.path) {
		input.respond({ status: 409, body: { error: "conflict", field: "name" } });

		// @ts-expect-error the conflict body must preserve its declared literal field
		input.respond({ status: 409, body: { error: "conflict", field: "title" } });
		// @ts-expect-error GET-only 404 is not a response of POST /items/:id
		input.respond({ status: 404, body: { error: "not_found" } });
	}

	if (input.method === "DELETE" && input.path === item.path) {
		input.respond({ status: 204 });
		input.respond({ status: 204, headers: { "Cache-Control": "no-store" } });

		// @ts-expect-error a declared no-content response forbids a body
		input.respond({ status: 204, body: undefined });
	}

	if (input.method === "GET" && input.path === audit.path) {
		input.respond({ status: 403, body: { error: "forbidden" } });
	}

	return { actor: "server" };
};

// @ts-expect-error rejection values cannot be forged without the module-private brand
const forgedContextResponse: ContextResponse = { status: 401, body: { error: "unauthorized" } };

const unavailable = schema<{ error: "unavailable" }>();
const health = route("/health");
const healthAPI = defineAPI({
	responses: { "503": unavailable },
	routes: {
		[health.path]: {
			route: health,
			serialization: "native",
			GET: { operationId: "health", responses: { "200": itemOutput } },
		},
	},
});
const composedAPI = composeAPIs(api, healthAPI);
type ComposedContextHook = NonNullable<CreateHandlerOptions<typeof composedAPI, ApplicationContext>["context"]>;

export const composedContext: ComposedContextHook = (input) => {
	if (input.method === "GET" && input.path === health.path) {
		input.respond({ status: 503, body: { error: "unavailable" } });

		// @ts-expect-error the first component's API-level response is not in the health component's scope
		input.respond({ status: 401, body: { error: "unauthorized" } });
	}

	if (input.method === "GET" && input.path === item.path) {
		input.respond({ status: 401, body: { error: "unauthorized" } });

		// @ts-expect-error the health component's API-level response is not in the item component's scope
		input.respond({ status: 503, body: { error: "unavailable" } });
	}

	return { actor: "server" };
};

const rateLimited = schema<{ error: "rate_limited" }>();
const globallyComposedAPI = composeAPIs({ responses: { "429": rateLimited } }, api, healthAPI);
type GlobalContextHook = NonNullable<CreateHandlerOptions<typeof globallyComposedAPI, ApplicationContext>["context"]>;

export const globalContext: GlobalContextHook = (input) => {
	input.respond({ status: 429, body: { error: "rate_limited" } });

	if (input.method === "GET" && input.path === health.path) {
		input.respond({ status: 503, body: { error: "unavailable" } });

		// @ts-expect-error the first component's response remains scoped under final global responses
		input.respond({ status: 401, body: { error: "unauthorized" } });
	}

	if (input.method === "GET" && input.path === item.path) {
		input.respond({ status: 401, body: { error: "unauthorized" } });

		// @ts-expect-error the health component's response remains scoped under final global responses
		input.respond({ status: 503, body: { error: "unavailable" } });
	}

	return { actor: "server" };
};

void forgedContextResponse;
