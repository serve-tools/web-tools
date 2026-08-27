import type { RouteParams } from "@serve-tools/router";
import { codec, route } from "@serve-tools/router";
import { createClient } from "../src/client.js";
import type { ResponseStatuses, Schema, SchemaInput, SchemaOutput } from "../src/http-contract.js";
import { adapterResponse, composeAPIs, defineAPI } from "../src/http-contract.js";
import { createHandler } from "../src/server.js";
import { createStaticClient } from "../src/static-client.js";

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

const note: Schema<{ title: string }, { id: number; title: string }> = {
	"~standard": { version: 1, vendor: "type-test", validate: () => ({ value: { id: 1, title: "note" } }) },
};
const custom: Schema<{ code: "invalid" }, { message: string }> = {
	"~standard": { version: 1, vendor: "type-test", validate: () => ({ value: { message: "invalid" } }) },
};
const wrapped = adapterResponse(custom, () => ({ code: "invalid" }));
adapterResponse(custom, async () => ({ code: "invalid" }));
// @ts-expect-error Producers must return the schema input, not its output.
adapterResponse(custom, () => ({ message: "invalid" }));
// @ts-expect-error Literal schema inputs remain constrained.
adapterResponse(custom, () => ({ code: "wrong" }));

const api = defineAPI({
	routes: {
		"/health": { GET: { responses: { 200: note } } },
		"/items/:id": { GET: { responses: { 200: note } } },
		"/items": { POST: { body: note, responses: { 201: note } } },
		"/custom": { POST: { body: note, responses: { 201: note, 400: wrapped } } },
		"/search": {
			route: route("/search", { search: { page: codec.integer().optional() } }),
			GET: { responses: { 200: note } },
		},
	},
});
const normalizedTwice = defineAPI(api);
const composed = composeAPIs(api, defineAPI({ routes: { "/empty": { DELETE: { responses: { 204: null } } } } }));

export type NormalizedInference = [
	Expect<Equal<RouteParams<(typeof api.routes)["/items/:id"]["route"]>, { id: string }>>,
	Expect<Equal<ResponseStatuses<typeof api, (typeof api.routes)["/health"]["GET"]>, 200>>,
	Expect<Equal<ResponseStatuses<typeof api, (typeof api.routes)["/items/:id"]["GET"]>, 200 | 400>>,
	Expect<Equal<ResponseStatuses<typeof api, (typeof api.routes)["/items"]["POST"]>, 201 | 400 | 413 | 415>>,
	Expect<Equal<ResponseStatuses<typeof api, (typeof api.routes)["/search"]["GET"]>, 200 | 400>>,
	Expect<
		Equal<
			ResponseStatuses<typeof normalizedTwice, (typeof normalizedTwice.routes)["/items"]["POST"]>,
			201 | 400 | 413 | 415
		>
	>,
	Expect<Equal<ResponseStatuses<typeof composed, (typeof composed.routes)["/health"]["GET"]>, 200>>,
	Expect<Equal<SchemaInput<typeof wrapped>, { code: "invalid" }>>,
	Expect<Equal<SchemaOutput<typeof wrapped>, { message: string }>>,
	Expect<Equal<"operationId" extends keyof (typeof api.routes)["/health"]["GET"] ? true : false, false>>,
];

export async function normalizedClient() {
	const client = createClient<typeof api>();
	await client.GET("/items/:id", { params: { id: "note" } });
	// @ts-expect-error Inferred path params are required.
	await client.GET("/items/:id");
	// @ts-expect-error Inferred path params are strings unless an explicit codec changes them.
	await client.GET("/items/:id", { params: { id: 1 } });
	const result = await client.POST("/items", { body: { title: "note" } });
	if (result.status === 201) {
		const id: number = result.body.id;
		const success: true = result.ok;
		void [id, success];
	} else if (result.status === 413) {
		const code: "request_too_large" = result.body.error;
		const success: false = result.ok;
		void [code, success];
	}
	const staticClient = createStaticClient<typeof api>();
	await staticClient.GET("/health");
	// @ts-expect-error Inferred dynamic paths cannot be called through the static client.
	await staticClient.GET("/items/:id");
}

createHandler(api, {
	context(input) {
		if (input.path === "/items" && input.method === "POST") {
			input.respond({ status: 413, body: { error: "request_too_large" } });
			// @ts-expect-error Inferred status and exact adapter error body stay correlated.
			input.respond({ status: 413, body: { error: "invalid_request" } });
		} else if (input.path === "/custom") {
			input.respond({ status: 400, body: { code: "invalid" } });
			// @ts-expect-error Responses must use schema input, not transformed output.
			input.respond({ status: 400, body: { message: "invalid" } });
		} else if (input.path === "/health") {
			// @ts-expect-error Request-body errors do not leak into unrelated health operations.
			input.respond({ status: 413, body: { error: "request_too_large" } });
		}
	},
	handlers: {
		"GET /health": () => ({ status: 200, body: { title: "health" } }),
		"GET /items/:id": () => ({ status: 200, body: { title: "note" } }),
		"POST /items": () => ({ status: 201, body: { title: "note" } }),
		"POST /custom": () => ({ status: 201, body: { title: "note" } }),
		"GET /search": () => ({ status: 200, body: { title: "search" } }),
	},
});
