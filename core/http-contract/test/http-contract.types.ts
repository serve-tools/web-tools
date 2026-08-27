import { codec, route } from "@serve-tools/router";
import { createClient } from "../src/client.js";
import type {
	API,
	APIResponses,
	APIRoutes,
	HTTPMethod,
	httpMethods,
	NormalizedResponseMap,
	OperationAt,
	OperationResponses,
	OwnOperationResponses,
	PathsForMethod,
	ResponseAt,
	ResponseInput,
	ResponseMap,
	ResponseMapAt,
	ResponseMapStatuses,
	ResponseOutput,
	ResponseStatuses,
	RouteAt,
	RoutePaths,
	Schema,
	SchemaInput,
	SchemaOutput,
} from "../src/http-contract.js";
import { composeAPIs, defineAPI, ProtocolError } from "../src/http-contract.js";
import type { Handlers } from "../src/server.js";
import { createStaticClient } from "../src/static-client.js";

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

function schema<Input, Output>(): Schema<Input, Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "type-test",
			validate: (value) => ({ value: value as Output }),
			types: undefined as never,
		},
	};
}

const organizationId = codec.integer();
const notes = route("/organizations/:organizationId/notes", {
	params: { organizationId },
	search: {
		cursor: codec.string().optional(),
		tag: codec.string().many(),
	},
});
const note = route("/organizations/:organizationId/notes/:noteId", {
	params: { organizationId, noteId: codec.integer() },
});
const createNote = schema<{ title: string }, { title: string; normalized: true }>();
const publicNote = schema<{ id: number; title: string }, { id: number; title: string; href: string }>();
const invalid = schema<{ error: "invalid_request" }, { error: "invalid_request" }>();
const missing = schema<{ error: "not_found" }, { error: "not_found" }>();

const notesAPI = defineAPI({
	responses: { 400: invalid },
	routes: {
		[notes.path]: {
			route: notes,
			serialization: "native",
			GET: {
				operationId: "listNotes",
				responses: { 200: schema<unknown, readonly { id: number; title: string }[]>() },
			},
			POST: {
				operationId: "createNote",
				body: createNote,
				responses: { 201: publicNote },
			},
		},
		[note.path]: {
			route: note,
			serialization: "native",
			GET: {
				operationId: "getNote",
				responses: { 200: publicNote, 404: missing },
			},
			DELETE: {
				operationId: "deleteNote",
				responses: { 204: null, 404: missing },
			},
		},
	},
});

const database = route("/database");
const status = route("/status");
const unavailable = schema<{ error: "unavailable" }, { error: "unavailable" }>();
const databaseAPI = defineAPI({
	responses: { 503: unavailable },
	routes: {
		[database.path]: {
			route: database,
			serialization: "native",
			GET: { operationId: "getDatabase", responses: { 200: publicNote } },
		},
	},
});
const statusAPI = defineAPI({
	routes: {
		[status.path]: {
			route: status,
			serialization: "native",
			GET: { operationId: "getStatus", responses: { 200: publicNote } },
		},
	},
});
const quoted = route("/quoted");
const reset = route("/reset");
const unauthorized = schema<{ error: "unauthorized" }, { error: "unauthorized" }>();
const quotedAPI = defineAPI({
	responses: { "401": unauthorized },
	routes: {
		[quoted.path]: {
			route: quoted,
			serialization: "native",
			GET: { operationId: "getQuoted", responses: { "200": publicNote, "404": missing } },
		},
		[reset.path]: {
			route: reset,
			serialization: "native",
			POST: { operationId: "reset", responses: { "205": null } },
		},
	},
});
const scopedAPI = composeAPIs(databaseAPI, statusAPI);
const composedAPI = composeAPIs(databaseAPI, statusAPI, notesAPI);
const rateLimited = schema<{ error: "rate_limited" }, { error: "rate_limited" }>();
const globallyComposedAPI = composeAPIs({ responses: { "429": rateLimited } }, databaseAPI, statusAPI);
const globalUnavailable = schema<{ error: "global_unavailable" }, { error: "global_unavailable" }>();
const overridingComposedAPI = composeAPIs({ responses: { "503": globalUnavailable } }, databaseAPI, statusAPI);

const removedResponsesDefinition = {
	commonResponses: { 400: invalid },
	routes: {
		[database.path]: {
			route: database,
			serialization: "native",
			GET: { operationId: "removedResponses", responses: { 200: publicNote } },
		},
	},
} as const;

// @ts-expect-error the removed commonResponses property is rejected for API variables.
defineAPI(removedResponsesDefinition);
// @ts-expect-error the removed commonResponses property is rejected for API literals.
defineAPI({ commonResponses: { 400: invalid }, routes: removedResponsesDefinition.routes });
// @ts-expect-error composition options use responses and reject the removed commonResponses property.
composeAPIs({ commonResponses: { 429: rateLimited } }, databaseAPI, statusAPI);
// @ts-expect-error composition options reject supplying both the current and removed property names.
composeAPIs({ responses: { 429: rateLimited }, commonResponses: { 503: unavailable } }, databaseAPI, statusAPI);

type NotesAPI = typeof notesAPI;
type GetNote = OperationAt<NotesAPI, "GET", typeof note.path>;
type CreateNote = OperationAt<NotesAPI, "POST", typeof notes.path>;
type DeleteNote = OperationAt<NotesAPI, "DELETE", typeof note.path>;
type ComposedAPI = typeof composedAPI;
type GetDatabase = OperationAt<ComposedAPI, "GET", typeof database.path>;
type GetStatus = OperationAt<ComposedAPI, "GET", typeof status.path>;
type ComposedGetNote = OperationAt<ComposedAPI, "GET", typeof note.path>;
type GlobalGetDatabase = OperationAt<typeof globallyComposedAPI, "GET", typeof database.path>;
type GlobalGetStatus = OperationAt<typeof globallyComposedAPI, "GET", typeof status.path>;
type OverriddenGetDatabase = OperationAt<typeof overridingComposedAPI, "GET", typeof database.path>;
type OverriddenGetStatus = OperationAt<typeof overridingComposedAPI, "GET", typeof status.path>;
type GetQuoted = OperationAt<typeof quotedAPI, "GET", typeof quoted.path>;
type Reset = OperationAt<typeof quotedAPI, "POST", typeof reset.path>;
type ExplicitCommonAPI = API<{ readonly "401": typeof unauthorized }, typeof quotedAPI.routes>;
type ExplicitNoCommonAPI = API<undefined, typeof quotedAPI.routes>;
type ExplicitEmptyCommonAPI = API<Record<never, never>, typeof quotedAPI.routes>;

// @ts-expect-error APICommonResponses was renamed APIResponses.
export type RemovedResponseExport = import("../src/http-contract.js").APICommonResponses<NotesAPI>;

export type PublicInference = [
	Expect<Equal<(typeof httpMethods)[number], HTTPMethod>>,
	Expect<Equal<RoutePaths<NotesAPI>, typeof notes.path | typeof note.path>>,
	Expect<Equal<keyof APIRoutes<NotesAPI>, typeof notes.path | typeof note.path>>,
	Expect<Equal<RouteAt<NotesAPI, typeof notes.path>, (typeof notesAPI.routes)[typeof notes.path]>>,
	Expect<Equal<PathsForMethod<NotesAPI, "POST">, typeof notes.path>>,
	Expect<Equal<PathsForMethod<NotesAPI, "DELETE">, typeof note.path>>,
	Expect<Equal<PathsForMethod<NotesAPI, "PATCH">, never>>,
	Expect<Equal<CreateNote["operationId"], "createNote">>,
	Expect<Equal<CreateNote["body"], typeof createNote>>,
	Expect<Equal<"body" extends keyof GetNote ? true : false, false>>,
	Expect<Equal<keyof APIResponses<NotesAPI>, 400>>,
	Expect<Equal<keyof OperationResponses<NotesAPI, GetNote>, 200 | 400 | 404>>,
	Expect<Equal<ResponseStatuses<NotesAPI, DeleteNote>, 204 | 400 | 404>>,
	Expect<Equal<ResponseAt<NotesAPI, GetNote, 200>, typeof publicNote>>,
	Expect<Equal<ResponseAt<NotesAPI, GetNote, 400>, typeof invalid>>,
	Expect<Equal<ResponseAt<NotesAPI, DeleteNote, 204>, null>>,
	Expect<Equal<SchemaInput<typeof createNote>, { title: string }>>,
	Expect<Equal<SchemaOutput<typeof createNote>, { title: string; normalized: true }>>,
	Expect<Equal<ResponseInput<typeof publicNote>, { id: number; title: string }>>,
	Expect<Equal<ResponseOutput<typeof publicNote>, { id: number; title: string; href: string }>>,
	Expect<Equal<ResponseInput<null>, undefined>>,
	Expect<Equal<ResponseOutput<null>, undefined>>,
	Expect<Equal<ResponseMapStatuses<{ readonly "200": typeof publicNote; readonly 404: typeof missing }>, 200 | 404>>,
	Expect<Equal<ResponseMapStatuses<ResponseMap>, number>>,
	Expect<Equal<ResponseMapAt<{ readonly "200": typeof publicNote }, 200>, typeof publicNote>>,
	Expect<Equal<keyof NormalizedResponseMap<{ readonly "200": typeof publicNote }>, 200>>,
	Expect<Equal<keyof APIResponses<typeof quotedAPI>, 401>>,
	Expect<Equal<keyof APIResponses<ExplicitCommonAPI>, 401>>,
	Expect<Equal<keyof APIResponses<ExplicitNoCommonAPI>, never>>,
	Expect<Equal<keyof APIResponses<ExplicitEmptyCommonAPI>, never>>,
	Expect<Equal<keyof OwnOperationResponses<GetQuoted>, 200 | 404>>,
	Expect<Equal<keyof OperationResponses<typeof quotedAPI, GetQuoted>, 200 | 401 | 404>>,
	Expect<Equal<ResponseStatuses<typeof quotedAPI, Reset>, 205 | 401>>,
	Expect<Equal<ResponseAt<typeof quotedAPI, GetQuoted, 200>, typeof publicNote>>,
	Expect<Equal<ResponseAt<typeof quotedAPI, GetQuoted, 401>, typeof unauthorized>>,
	Expect<Equal<ResponseAt<typeof quotedAPI, Reset, 205>, null>>,
	Expect<
		Equal<RoutePaths<ComposedAPI>, typeof database.path | typeof status.path | typeof notes.path | typeof note.path>
	>,
	Expect<
		Equal<
			PathsForMethod<ComposedAPI, "GET">,
			typeof database.path | typeof status.path | typeof notes.path | typeof note.path
		>
	>,
	Expect<Equal<GetDatabase["operationId"], "getDatabase">>,
	Expect<Equal<GetStatus["operationId"], "getStatus">>,
	Expect<Equal<keyof APIResponses<ComposedAPI>, never>>,
	Expect<Equal<keyof OwnOperationResponses<GetDatabase>, 200 | 503>>,
	Expect<Equal<keyof OperationResponses<ComposedAPI, GetDatabase>, 200 | 503>>,
	Expect<Equal<keyof OperationResponses<ComposedAPI, GetStatus>, 200>>,
	Expect<Equal<keyof OperationResponses<ComposedAPI, ComposedGetNote>, 200 | 400 | 404>>,
	Expect<Equal<ResponseAt<ComposedAPI, GetDatabase, 503>, typeof unavailable>>,
	Expect<Equal<keyof APIResponses<typeof globallyComposedAPI>, 429>>,
	Expect<Equal<keyof OperationResponses<typeof globallyComposedAPI, GlobalGetDatabase>, 200 | 429 | 503>>,
	Expect<Equal<keyof OperationResponses<typeof globallyComposedAPI, GlobalGetStatus>, 200 | 429>>,
	Expect<Equal<ResponseAt<typeof globallyComposedAPI, GlobalGetDatabase, 503>, typeof unavailable>>,
	Expect<Equal<ResponseAt<typeof globallyComposedAPI, GlobalGetStatus, 429>, typeof rateLimited>>,
	Expect<Equal<keyof OwnOperationResponses<OverriddenGetDatabase>, 200>>,
	Expect<Equal<ResponseAt<typeof overridingComposedAPI, OverriddenGetDatabase, 503>, typeof globalUnavailable>>,
	Expect<Equal<ResponseAt<typeof overridingComposedAPI, OverriddenGetStatus, 503>, typeof globalUnavailable>>,
];

async function assertComposedClientTypes(): Promise<void> {
	const client = createClient<ComposedAPI>();
	const databaseResult = await client.GET(database.path);

	if (databaseResult.status === 503) {
		databaseResult.body.error satisfies "unavailable";
	}

	const statusResult = await client.GET(status.path);

	if (statusResult.status === 200) {
		statusResult.body.href satisfies string;
	}

	await client.POST(notes.path, {
		params: { organizationId: 42 },
		search: { tag: [] },
		body: { title: "Composed" },
	});
}

void assertComposedClientTypes;

async function assertQuotedClientTypes(): Promise<void> {
	const client = createClient<typeof quotedAPI>();
	const result = await client.GET(quoted.path);

	switch (result.status) {
		case 200:
			result.body.href satisfies string;
			break;
		case 401:
			result.body.error satisfies "unauthorized";
			break;
		case 404:
			result.body.error satisfies "not_found";
			break;
		default:
			result satisfies never;
	}

	const staticClient = createStaticClient<typeof quotedAPI>();
	const resetResult = await staticClient.POST(reset.path);

	if (resetResult.status === 205) {
		resetResult.ok satisfies true;
		resetResult.body satisfies undefined;
	}
}

void assertQuotedClientTypes;

const quotedHandlers: Handlers<typeof quotedAPI> = {
	"GET /quoted": () => ({ status: 404, body: { error: "not_found" } }),
	"POST /reset": () => ({ status: 205 }),
};

const invalidQuotedHandlers: Handlers<typeof quotedAPI> = {
	// @ts-expect-error a quoted status retains its declared response body
	"GET /quoted": () => ({ status: 404, body: { error: "unauthorized" } }),
	"POST /reset": () => ({ status: 205 }),
};

void quotedHandlers;
void invalidQuotedHandlers;

const scopedHandlers: Handlers<typeof scopedAPI> = {
	"GET /database": () => ({ status: 503, body: { error: "unavailable" } }),
	"GET /status": () => ({ status: 200, body: { id: 1, title: "Ready" } }),
};

const invalidScopedHandlers: Handlers<typeof scopedAPI> = {
	"GET /database": () => ({ status: 200, body: { id: 1, title: "Ready" } }),
	// @ts-expect-error status 503 belongs only to the database component
	"GET /status": () => ({ status: 503, body: { error: "unavailable" } }),
};

void scopedHandlers;
void invalidScopedHandlers;

const collidingDatabaseAPI = defineAPI({
	routes: {
		[database.path]: {
			route: database,
			serialization: "native",
			POST: { operationId: "replaceDatabase", responses: { 204: null } },
		},
	},
});

// @ts-expect-error composed APIs must declare distinct exact route paths
composeAPIs(databaseAPI, collidingDatabaseAPI);

type StressComponents<Values extends readonly API[] = []> = Values["length"] extends 50
	? Values
	: StressComponents<
			readonly [
				...Values,
				API<
					undefined,
					{
						[Path in `/stress/${Values["length"]}`]: {
							readonly route: ReturnType<typeof route<Path>>;
							readonly GET: {
								readonly operationId: Path;
								readonly responses: { readonly 200: typeof publicNote };
							};
						};
					}
				>,
			]
		>;

declare const stressComponents: StressComponents;
const stressAPI = composeAPIs(...stressComponents);
// @ts-expect-error late duplicate paths remain rejected beyond the former recursion limit
composeAPIs(...stressComponents, stressComponents[0]);
export type StressInference = Expect<
	Equal<ResponseAt<typeof stressAPI, OperationAt<typeof stressAPI, "GET", "/stress/49">, 200>, typeof publicNote>
>;

new ProtocolError("Invalid request");
new ProtocolError("Invalid response", { method: "POST", path: notes.path, status: 201, operationId: "createNote" });

// @ts-expect-error only a path supporting POST can select a POST operation
export type InvalidPostPath = OperationAt<NotesAPI, "POST", typeof note.path>;
// @ts-expect-error response 201 is not declared by getNote or the API's API-level responses
export type InvalidGetStatus = ResponseAt<NotesAPI, GetNote, 201>;
// @ts-expect-error Standard Schema request inputs remain distinct from transformed outputs
const requestInput: SchemaInput<typeof createNote> = { title: "Note", normalized: true };
// @ts-expect-error null is the only bodyless response marker
const invalidResponseMarker: ResponseAt<NotesAPI, DeleteNote, 204> = publicNote;

void requestInput;
void invalidResponseMarker;
