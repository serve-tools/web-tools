import { defineAPI } from "@serve-tools/http-contract";
import { createClient, isStatus } from "@serve-tools/http-contract/client";
import { codec, route } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";

interface Note {
	readonly id: number;
	readonly title: string;
}

const noteSchema: StandardSchemaV1<Note> = {
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

const noteRoute = route("/notes/:noteId", {
	params: { noteId: codec.integer() },
	search: { fields: codec.string().many() },
});

export const notesAPI = defineAPI({
	routes: {
		[noteRoute.path]: {
			route: noteRoute,
			serialization: "native",
			GET: {
				operationId: "getNote",
				responses: { 200: noteSchema },
			},
		},
	},
});

const notes = createClient<typeof notesAPI>({ baseURL: "https://api.example.test/" });

export async function readNote(noteId: number): Promise<string | undefined> {
	const result = await notes.GET(noteRoute.path, {
		params: { noteId },
		search: { fields: ["title"] },
	});

	if (isStatus(result, 200)) {
		return result.data.title;
	}

	return undefined;
}
