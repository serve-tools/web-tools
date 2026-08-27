# @serve-tools/http-contract

`@serve-tools/http-contract` declares TypeScript-owned JSON HTTP APIs once, then lets trusted server code validate them and browser code call them without importing validators or application schema modules.

It is framework-neutral and uses [Standard Schema](https://standardschema.dev/) version 1 for validation.
OpenAPI 3.1 is optional derived output for validators that also implement Standard JSON Schema.

## Install

```shell
npm install @serve-tools/http-contract
```

Install `@serve-tools/router` when your application imports it to declare routes.
Your application selects and installs its own Standard Schema-compatible validator.

## First endpoint

This example uses Zod, installed by the application, to serve and call one fixed endpoint.
Other Standard Schema validators work without changing the HTTP API.

```ts
// server/health-api.ts — trusted code
import * as z from "zod";
import { defineAPI } from "@serve-tools/http-contract";
import { createHandler } from "@serve-tools/http-contract/server";

export const healthAPI = defineAPI({
	routes: {
		"/health": {
			GET: { responses: { 200: z.object({ ready: z.boolean() }) } },
		},
	},
});

export const handle = createHandler(healthAPI, {
	handlers: {
		"GET /health": () => ({
			status: 200,
			body: { ready: true },
			headers: { "Cache-Control": "no-store" },
		}),
	},
});
```

Pass `handle(request)` to your server's Fetch adapter.
The browser imports only the contract's type:

```ts
// browser/health.ts
import type { healthAPI } from "../server/health-api.js";
import { createStaticClient } from "@serve-tools/http-contract/client/static";

const api = createStaticClient<typeof healthAPI>();
const result = await api.GET("/health");

if (result.status === 200) console.log(result.body.ready);
```

Use the static client for fixed paths, including the fixed subset of a larger API.
Use the general client below for pathname parameters, search values, or custom URL formatting.

## Declare a public API

Keep routes in an optional schema-free module when a custom codec needs browser-side `href()` construction.
Keep executable validators and the contract value in trusted application code.

```ts
import { codec, route } from "@serve-tools/router";
import { defineAPI } from "@serve-tools/http-contract";
import * as v from "zod";

const noteRoute = route("/organizations/:organizationId/notes/:noteId", {
	params: { organizationId: codec.integer(), noteId: codec.integer() },
});

const note = v.object({ id: v.number(), title: v.string(), content: v.string() });
const missing = v.object({ error: v.literal("not_found") });
const unauthorized = v.object({ error: v.literal("unauthorized") });

export const notesAPI = defineAPI({
	responses: { 401: unauthorized },
	routes: {
		[noteRoute.path]: {
			route: noteRoute,
			GET: {
				summary: "Read a note",
				tags: ["notes"],
				security: [{ bearerAuth: [] }],
				responses: { 200: note, 404: missing },
			},
			DELETE: { responses: { 204: null, 404: missing } },
		},
	},
});
```

Each operation declares explicit 2xx, 4xx, or 5xx responses, including at least one successful 2xx response.
Use `null` only for bodyless 204 or 205 responses.
The API-level `responses` map supplies shared 4xx/5xx schemas to every operation, while an operation's `responses` map declares that operation's own outcomes.
When both maps declare a status, they must reference the same schema object; use one map instead of separately constructed but merely equivalent schemas.

`defineAPI()` infers a string-parameter route from the route-map key when `route` is omitted and defaults serialization to `"native"`.
Provide an explicit router route when you need typed pathname/search codecs or `href` serialization.
`operationId` is optional and is never synthesized; add one only when external documentation or tooling needs a stable identifier.

The normalized contract automatically materializes adapter responses where they apply: `400` for pathname/search decoding or a JSON body, and `413` and `415` for a JSON body.
An operation response or API-level `responses` entry at the same status takes precedence.
Use `adapterResponse(schema, ({ request, status }) => body)` when an adapter-generated response must use a custom schema and body; the producer output is validated like every other response.

```ts
import { adapterResponse } from "@serve-tools/http-contract";

const invalidRequest = adapterResponse(
	v.object({ error: v.literal("invalid_request"), method: v.string(), status: v.number() }),
	({ request, status }) => ({ error: "invalid_request", method: request.method, status }),
);
```

Place that wrapped schema at `400` in an operation or API-level `responses`.

## Compose a public API from components

Declare each component with only the failures that belong to its own operations, then compose the components at the application boundary.
Composition materializes each component's API-level `responses` into that component's operations, so they do not leak onto unrelated operations.

```ts
import { composeAPIs, defineAPI } from "@serve-tools/http-contract";

const unavailable = v.object({ status: v.literal("unavailable") });
const rateLimited = v.object({ error: v.literal("rate_limited") });

export const databaseAPI = defineAPI({
	responses: { 503: unavailable },
	routes: {
		"/database/status": {
			GET: { responses: { 200: v.object({ status: v.literal("ready") }) } },
		},
	},
});

export const publicAPI = composeAPIs({ responses: { 429: rateLimited } }, databaseAPI, notesAPI);
```

`composeAPIs()` returns one normal validated API with flattened routes.
It rejects duplicate route paths and operation IDs.
Its overload with an API-level `responses` map declares failures intentionally shared by every operation in that final API.
Component responses remain scoped even when the final API also has a global response envelope.
If a final global map uses the same status as a component response, the global schema is the public schema for that status.
It must accept the bodies produced at every layer that can return that status.

Use nested composition when middleware protects only one component:

```ts
const protectedDatabaseAPI = composeAPIs(
	{ responses: { 401: unauthorized, 429: rateLimited } },
	databaseAPI,
);
const applicationAPI = composeAPIs(protectedDatabaseAPI, healthAPI);
```

Browser clients must use the exposed contract type, including known middleware outcomes.
The public health component does not acquire database authentication or availability responses.

`@serve-tools/router` owns typed pathname and search inputs, URL construction, and trusted matching.
HTTP contracts support the narrower path grammar of complete literal or `:parameter` segments; affixed parameters supported by the generic router are not HTTP contract paths.
Omitted `serialization` defaults to `"native"`; explicit `"native"` remains valid.
Native serialization accepts only codecs whose router metadata marks their wire form as native: built-in string, safe-integer, and identity enum codecs.
For a custom `codec.schema()` formatter, router marks the codec non-native, so set `serialization: "href"` and pass a prebuilt `route.href()` URL from a deliberately browser-safe route module.
Same-method routes must not shadow each other: `/items/:id` with string IDs conflicts with `/items/me`.
Native integer IDs or enum values that exclude `me` can prove those paths disjoint; prebuilt `href` strings cannot.
HTTP selection remains independent of the browser router's intentional list-order matching policy.

## Call from a browser or worker

Import the executable contract only as a type, so validators, database declarations, and server code do not enter the client bundle.

```ts
import type { notesAPI } from "../server/notes-api.js";
import { createClient } from "@serve-tools/http-contract/client";

const api = createClient<typeof notesAPI>({ baseURL: "https://api.example.test/" });
const result = await api.GET("/organizations/:organizationId/notes/:noteId", {
	params: { organizationId: 42, noteId: 7 },
});

if (result.status === 200) {
	render(result.body.title);
} else if (result.status === 404) {
	showMissing(result.body);
}
```

`HTTPResult` is a schema-derived discriminated union with the same four fields in every branch: `status`, literal `ok`, typed `body`, and the native `response`.
Compare `result.status` directly to expose the exact declared response body, including declared 5xx failures such as `503`.
For declared `204` and `205`, `body` is `undefined`.
The browser imports the executable contract only as a type and performs no schema validation, so this status typing trusts the server contract.
Malformed JSON and non-JSON responses reject with `ProtocolError`, whose `response` property retains the original `Response` for response-related failures.
A proxy or other upstream may still return valid JSON with an undeclared status, or a bodyless `204`/`205`, at runtime because the generic client does not ship contract status metadata.
Network failures, aborts, URL errors, and unsafe JSON serialization reject with `ProtocolError` or the native Fetch error.
Both client entrypoints export the same `ProtocolError` class as the package root.
`baseURL` resolves absolute contract paths against an origin, not an API prefix: `/health` with `https://api.example.test/root/` still requests `https://api.example.test/health`.

Put native per-request Fetch metadata under `init`:

```ts
await api.GET("/organizations/:organizationId/notes/:noteId", {
	params: { organizationId: 42, noteId: 7 },
	init: { credentials: "include", headers: { Authorization: "Bearer token" }, signal },
});
```

The adapter owns `method`, request-body serialization, `Accept`, and `Content-Type`, and rejects `mode: "no-cors"` because an opaque response cannot satisfy the JSON contract.
For framework-specific RequestInit keys, pass an explicit second generic to `createClient`, such as `createClient<typeof notesAPI, FrameworkInitExtension>()`; this does not weaken typed route inputs or bodies.
The same generic contextually types the injected `fetch` callback's native `RequestInit`, where extension keys are optional because a request may omit `init`.
This applies to both client entrypoints.

## Call a fixed browser endpoint

For selected native routes that are fixed literal paths with no params or search values, use the smaller static client entrypoint.
The full API may also contain parameterized, search, or `href` routes; those operations are excluded from this client's methods.
It keeps the same typed methods, request options, and status-discriminated results without shipping generic route serialization.

```ts
import type { healthAPI } from "../server/health-api.js";
import { createStaticClient } from "@serve-tools/http-contract/client/static";

const health = createStaticClient<typeof healthAPI>({ baseURL: "https://api.example.test/" });
const result = await health.GET("/health");

if (result.status === 200) render(result.body);
```

Use `@serve-tools/http-contract/client` for calls that need pathname parameters, search values, or a prebuilt `href`.
Both client entrypoints retain only a type import of the application contract and do not ship its validators.

## Serve a contract

```ts
import { createHandler } from "@serve-tools/http-contract/server";
import { notesAPI } from "./notes-api.js";

export const fetch = createHandler(notesAPI, {
	context: async ({ request, params, respond }) => {
		if (!(await mayReadOrganization(request, params.organizationId))) {
			return respond({
				status: 401,
				body: { error: "unauthorized" },
				headers: { "WWW-Authenticate": "Bearer" },
			});
		}
		return undefined;
	},
	handlers: {
		"GET /organizations/:organizationId/notes/:noteId": async ({ params }) => ({
			status: 200,
			body: await readPublicNote(params.organizationId, params.noteId),
		}),
		"DELETE /organizations/:organizationId/notes/:noteId": async ({ params }) => {
			await removePublicNote(params.organizationId, params.noteId);
			return { status: 204 };
		},
	},
});
```

The server validates request inputs and response outputs through Standard Schema and serializes JSON only after the response schema accepts it.
Authorization, sessions, CORS, CSRF, rate limits, database access, logging, tracing, retries, and exception policy remain application-owned.
Route declarations and TypeScript types are never authorization.

Context receives literal `method` and `path` discriminants alongside the matched request, signal, params, and search values.
Use its operation-bound `respond({ status, body?, headers? })` to end authorization early.
It returns a branded `ContextResponse`, and TypeScript allows only status/body pairs declared for that exact method and path, including applicable API-level responses.

Handler results accept optional native `HeadersInit` values in `headers`, including on bodyless 204 and 205 results.
Context responses use the same result object as handlers:

```ts
respond({ status: 401, body: { error: "unauthorized" }, headers: { "WWW-Authenticate": "Bearer" } });
respond({ status: 204, headers: { "Cache-Control": "no-store" } });
```

The adapter rejects caller-supplied `Content-Type`, `Content-Length`, `Content-Encoding`, and `Transfer-Encoding` response headers because it owns JSON serialization and payload framing.
Headers do not bypass status or body validation.

Independently authored handler maps can use `satisfies Handlers<typeof componentAPI>` from the server entrypoint and be spread into the composed handler's `handlers` object.
The final map must implement every composed operation.

Unknown paths and unsupported methods return adapter-owned JSON `404` and `405` responses before application context or handlers run.
To expose or customize them in a final API, declare `adapterResponse(...)` entries at `404` and `405` in its API-level `responses`.

## Derive OpenAPI

```ts
import { toOpenAPI } from "@serve-tools/http-contract/openapi";
import { notesAPI } from "./notes-api.js";

export const document = toOpenAPI(notesAPI, {
	info: { title: "Notes API", version: "1.0.0", description: "Public note operations" },
	tags: [{ name: "notes", description: "Read and delete notes" }],
	securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
});
```

The projector emits deterministic OpenAPI 3.1 paths, methods, codec-derived pathname and query parameters, JSON request bodies, declared API-level and operation responses, and readable standard status descriptions such as `200 OK` and `503 Service Unavailable`.
Contract operations accept closed documentation metadata: optional `operationId`, `summary`, `description`, `tags`, `deprecated`, and `security`.
Projection options accept closed API metadata for `info`, `servers`, tag descriptions, security schemes, and an optional API-wide security requirement.
Operation security overrides the API-wide requirement; an empty array makes an operation public.
Integer and enum codec metadata become their corresponding OpenAPI schemas, optional/default/repeated search codecs become query metadata, and conflicting templated paths are rejected.
Custom codecs project conservatively as strings without decoded defaults.
OpenAPI cannot represent two paths with the same templated hierarchy and different parameter names, even when their HTTP methods differ; such an otherwise valid HTTP API is rejected only when this optional projection runs.
It requests `input({ target: "draft-2020-12" })` for request bodies and `output({ target: "draft-2020-12" })` for responses.
It throws only when invoked if a visited schema lacks Standard JSON Schema conversion.
It never publishes an OpenAPI route or infers summaries, tags, security schemes, internal storage fields, or application visibility.

## Migration to 0.2

Version 0.2 intentionally replaces several 0.1 contracts.

Remove `isStatus` imports and narrow declared results directly by `result.status`.
Replace successful `result.data`, failed `result.error`, and `result.kind` access with the uniform `result.body` field.
Move credentials, headers, signals, and other native Fetch metadata under the request's `init` property.
Rename API-level `commonResponses` to `responses` and the public type `APICommonResponses` to `APIResponses`.
Operation-level `responses` remains unchanged.

Version 0.1 returned malformed or non-JSON responses as `{ kind: "raw" }` values.
Version 0.2 instead rejects them with `ProtocolError` and retains the native response on `error.response`:

```ts
import type { healthAPI } from "../server/health-api.js";
import { createClient, ProtocolError } from "@serve-tools/http-contract/client";

const api = createClient<typeof healthAPI>();

try {
	const result = await api.GET("/health");
	if (result.status === 200) render(result.body);
} catch (error) {
	if (error instanceof ProtocolError && error.response !== undefined) {
		inspectUnexpectedResponse(error.response);
	} else {
		throw error;
	}
}
```

Rethrow errors without a response so native network and abort failures, plus local request-contract failures, retain their distinct behavior.
A valid JSON response with an undeclared status is still returned at runtime because the generic client does not ship contract status metadata.

Remove `reject()` imports and use the context input's operation-bound `respond({ status, body?, headers? })` function for typed short circuits.
Remove `errorBodies` handler options; declare the status in the contract and wrap custom adapter-produced bodies with `adapterResponse(...)`.
Remove explicit default `400`, `413`, and `415` declarations unless their schema or adapter-produced body is application-specific.
Replace same-method route shadows with disjoint paths or one operation whose response schema explicitly covers its outcomes.

Existing explicit routes, serialization modes, operation IDs, and method/path handler keys remain supported.

## Agent Skill

This package includes `skills/serve-tools-http-contract/SKILL.md` with consumer guidance.
Installing it does not grant browser code access to your executable contract or make generated OpenAPI public.

## Development

```shell
npm run typecheck --workspace @serve-tools/http-contract
npm test --workspace @serve-tools/http-contract
npm run build --workspace @serve-tools/http-contract
npm run check:package --workspace @serve-tools/http-contract
npm run benchmark --workspace @serve-tools/http-contract
npm run benchmark:types --workspace @serve-tools/http-contract -- --operations 100,250 --editor
```

## License

[MIT-0](./LICENSE.md)
