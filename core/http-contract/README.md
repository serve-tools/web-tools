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

## Declare a public API

Keep routes in an optional schema-free module when a custom codec needs browser-side `href()` construction.
Keep executable validators and the contract value in trusted application code.

```ts
import { codec, route } from "@serve-tools/router";
import { defineAPI } from "@serve-tools/http-contract";
import * as v from "your-standard-schema-validator";

const noteRoute = route("/organizations/:organizationId/notes/:noteId", {
	params: { organizationId: codec.integer(), noteId: codec.integer() },
});

const note = v.object({ id: v.number(), title: v.string(), content: v.string() });
const missing = v.object({ error: v.literal("not_found") });
const unauthorized = v.object({ error: v.literal("unauthorized") });

export const notesAPI = defineAPI({
	commonResponses: { 401: unauthorized },
	routes: {
		[noteRoute.path]: {
			route: noteRoute,
			serialization: "native",
			GET: { operationId: "getNote", responses: { 200: note, 404: missing } },
			DELETE: { operationId: "deleteNote", responses: { 204: null, 404: missing } },
		},
	},
});
```

Each operation declares explicit 2xx, 4xx, or 5xx responses, including at least one successful 2xx response.
Use `null` only for bodyless 204 or 205 responses.
`commonResponses` supplies shared 4xx/5xx schemas to every operation.

`@serve-tools/router` remains the owner of route syntax, typed pathname and search inputs, URL construction, and trusted server matching.
For `serialization: "native"`, this package can serialize only router’s built-in string, safe-integer, and identity enum wire forms.
For a custom `codec.schema()` formatter, set `serialization: "href"` and pass a prebuilt `route.href()` URL from a deliberately browser-safe route module.

## Call from a browser or worker

Import the executable contract only as a type, so validators, database declarations, and server code do not enter the client bundle.

```ts
import type { notesAPI } from "../server/notes-api.js";
import { createClient, isStatus } from "@serve-tools/http-contract/client";

const api = createClient<typeof notesAPI>({ baseURL: "https://api.example.test/" });
const result = await api.GET("/organizations/:organizationId/notes/:noteId", {
	params: { organizationId: 42, noteId: 7 },
});

if (isStatus(result, 200)) {
	render(result.data.title);
} else if (isStatus(result, 404)) {
	showMissing(result.error);
}
```

Before `isStatus()`, every result retains its actual numeric `status`, native `Response`, and an unknown JSON payload or raw response representation.
The helper checks a status and response kind; it does not validate a payload in the browser.
Unexpected proxy, middleware, or gateway statuses remain visible rather than being cast into the declared union.
Network, abort, URL, and unsafe JSON serialization failures reject normally.

## Serve a contract

```ts
import { createHandler, reject } from "@serve-tools/http-contract/server";
import { notesAPI } from "./notes-api.js";

export const fetch = createHandler(notesAPI, {
	context: async ({ request, params }) => {
		if (!(await mayReadOrganization(request, params.organizationId))) return reject(401, { error: "unauthorized" });
		return {};
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

## Derive OpenAPI

```ts
import { toOpenAPI } from "@serve-tools/http-contract/openapi";
import { notesAPI } from "./notes-api.js";

export const document = toOpenAPI(notesAPI, {
	info: { title: "Notes API", version: "1.0.0" },
});
```

The adapter emits deterministic OpenAPI 3.1 paths, methods, string path parameters, JSON request bodies, and declared/common responses.
It requests `input({ target: "draft-2020-12" })` for request bodies and `output({ target: "draft-2020-12" })` for responses.
It throws only when invoked if a visited schema lacks Standard JSON Schema conversion.
It never publishes an OpenAPI route or infers security schemes, internal storage fields, or application visibility.

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
