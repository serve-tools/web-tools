import { codec, route } from "@serve-tools/router";
import type {
	APICommonResponses,
	APIRoutes,
	HTTPMethod,
	httpMethods,
	OperationAt,
	OperationResponses,
	PathsForMethod,
	ResponseAt,
	ResponseInput,
	ResponseOutput,
	ResponseStatuses,
	RouteAt,
	RoutePaths,
	Schema,
	SchemaInput,
	SchemaOutput,
} from "../src/http-contract.js";
import { defineAPI, ProtocolError } from "../src/http-contract.js";

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
	commonResponses: { 400: invalid },
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

type NotesAPI = typeof notesAPI;
type GetNote = OperationAt<NotesAPI, "GET", typeof note.path>;
type CreateNote = OperationAt<NotesAPI, "POST", typeof notes.path>;
type DeleteNote = OperationAt<NotesAPI, "DELETE", typeof note.path>;

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
	Expect<Equal<keyof APICommonResponses<NotesAPI>, 400>>,
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
];

new ProtocolError("Invalid request");
new ProtocolError("Invalid response", { method: "POST", path: notes.path, status: 201, operationId: "createNote" });

// @ts-expect-error only a path supporting POST can select a POST operation
export type InvalidPostPath = OperationAt<NotesAPI, "POST", typeof note.path>;
// @ts-expect-error response 201 is not declared by getNote or the API's common responses
export type InvalidGetStatus = ResponseAt<NotesAPI, GetNote, 201>;
// @ts-expect-error Standard Schema request inputs remain distinct from transformed outputs
const requestInput: SchemaInput<typeof createNote> = { title: "Note", normalized: true };
// @ts-expect-error null is the only bodyless response marker
const invalidResponseMarker: ResponseAt<NotesAPI, DeleteNote, 204> = publicNote;

void requestInput;
void invalidResponseMarker;
