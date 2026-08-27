# Recipe: quick start

This public-import example is generated from the compile-checked `test/http-contract.recipes.ts` fixture in the package source.

```ts
import { defineAPI } from "@serve-tools/http-contract";
import { createClient } from "@serve-tools/http-contract/client";
import { createHandler } from "@serve-tools/http-contract/server";
import { codec, route } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";

interface Note {
	readonly id: number;
	readonly title: string;
}

// Use your installed Standard Schema validator in an application.
// Portable validators are defined below to keep this compiled recipe dependency-neutral.
const noteSchema = createNoteSchema();
const unauthorizedSchema = errorSchema("unauthorized");

const noteRoute = route("/notes/:noteId", {
	params: { noteId: codec.integer() },
	search: { fields: codec.string().many() },
});

export const notesAPI = defineAPI({
	responses: { 401: unauthorizedSchema },
	routes: {
		[noteRoute.path]: {
			route: noteRoute,
			GET: { responses: { 200: noteSchema } },
		},
	},
});

export const handleNotes = createHandler(notesAPI, {
	context: ({ request, respond }) =>
		request.headers.has("authorization")
			? undefined
			: respond({
					status: 401,
					body: { error: "unauthorized" },
					headers: { "WWW-Authenticate": "Bearer" },
				}),
	handlers: {
		"GET /notes/:noteId": ({ params }) => ({
			status: 200,
			body: { id: params.noteId, title: "A public note" },
			headers: { "Cache-Control": "no-store" },
		}),
	},
});

// A browser module imports notesAPI only as a type.
const notes = createClient<typeof notesAPI>({ baseURL: "https://api.example.test/" });

export async function readNote(noteId: number, signal: AbortSignal): Promise<string> {
	const result = await notes.GET(noteRoute.path, {
		params: { noteId },
		search: { fields: ["title"] },
		init: { headers: { Authorization: "Bearer token" }, signal },
	});

	if (result.status === 200) {
		return result.body.title;
	}

	throw new Error(result.body.error);
}

function createNoteSchema(): StandardSchemaV1<Note> {
	return {
		"~standard": {
			version: 1,
			vendor: "example",
			validate(value) {
				if (
					typeof value !== "object" ||
					value === null ||
					!("id" in value) ||
					!("title" in value) ||
					typeof value.id !== "number" ||
					typeof value.title !== "string"
				) {
					return { issues: [{ message: "Expected a public note" }] };
				}
				return { value: { id: value.id, title: value.title } };
			},
		},
	};
}

function errorSchema<const Code extends string>(error: Code): StandardSchemaV1<{ error: Code }> {
	return {
		"~standard": {
			version: 1,
			vendor: "example",
			validate(value) {
				return typeof value === "object" && value !== null && "error" in value && value.error === error
					? { value: { error } }
					: { issues: [{ message: "Expected the declared error" }] };
			},
		},
	};
}
```
