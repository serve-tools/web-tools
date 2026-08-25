import { codec, route } from "@serve-tools/router";
import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it, vi } from "vitest";
import { createClient, isStatus } from "../src/client.js";
import { defineAPI } from "../src/http-contract.js";
import { toOpenAPI } from "../src/openapi.js";
import { createHandler, reject } from "../src/server.js";

type ConvertibleSchema<Input, Output = Input> = StandardSchemaV1<Input, Output> & StandardJSONSchemaV1<Input, Output>;

function schema<Input, Output = Input>(
	validate: (value: unknown) => StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>>,
	input: Record<string, unknown> = { type: "object" },
	output: Record<string, unknown> = input,
): ConvertibleSchema<Input, Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "http-contract-conformance",
			validate,
			jsonSchema: {
				input: () => input,
				output: () => output,
			},
		},
	};
}

function errorSchema<const ErrorCode extends string>(code: ErrorCode): ConvertibleSchema<{ error: ErrorCode }> {
	return schema((value) =>
		typeof value === "object" && value !== null && "error" in value && value.error === code
			? { value: { error: code } }
			: { issues: [{ message: "Invalid public error" }] },
	);
}

interface InternalNote {
	readonly id: number;
	readonly title: string;
	readonly privateToken: string;
}

interface PublicNote {
	readonly id: number;
	readonly title: string;
}

const noteInput = schema<{ title: string }, { normalizedTitle: string }>(async (value) => {
	if (typeof value !== "object" || value === null || !("title" in value) || typeof value.title !== "string") {
		return { issues: [{ message: "Expected a note title" }] };
	}

	return { value: { normalizedTitle: value.title.trim() } };
});

const publicNote = schema<InternalNote, PublicNote>(
	(value) => {
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
	{ type: "object", properties: { id: { type: "integer" }, title: { type: "string" } } },
	{ type: "object", properties: { id: { type: "integer" }, title: { type: "string" } } },
);

const noteList = schema<PublicNote[]>((value) =>
	Array.isArray(value)
		? { value: value as PublicNote[] }
		: { issues: [{ message: "Expected a public note collection" }] },
);

const notesRoute = route("/organizations/:organizationId/notes", {
	params: { organizationId: codec.integer() },
	search: { tag: codec.string().many() },
});

const noteRoute = route("/organizations/:organizationId/notes/:noteId", {
	params: { organizationId: codec.integer(), noteId: codec.integer() },
});

const notesAPI = defineAPI({
	commonResponses: {
		400: errorSchema("invalid_request"),
		401: errorSchema("unauthorized"),
	},
	routes: {
		[notesRoute.path]: {
			route: notesRoute,
			serialization: "native",
			GET: { operationId: "listNotes", responses: { 200: noteList } },
			POST: { operationId: "createNote", body: noteInput, responses: { 201: publicNote } },
		},
		[noteRoute.path]: {
			route: noteRoute,
			serialization: "native",
			GET: { operationId: "getNote", responses: { 200: publicNote, 404: errorSchema("not_found") } },
			DELETE: { operationId: "deleteNote", responses: { 204: null, 404: errorSchema("not_found") } },
		},
	},
});

function connectedAPI() {
	const contexts = vi.fn(({ request, params }: { request: Request; params: { organizationId: number } }) => {
		if (request.headers.has("x-denied")) {
			return reject(401, { error: "unauthorized" });
		}

		return { organizationId: params.organizationId };
	});

	const handle = createHandler(notesAPI, {
		context: contexts,
		handlers: {
			"GET /organizations/:organizationId/notes": ({ params, search, context }) => ({
				status: 200,
				body: [{ id: params.organizationId, title: `${context.organizationId}:${search.tag.join(",")}` }],
			}),
			"POST /organizations/:organizationId/notes": ({ body, context }) => ({
				status: 201,
				body: { id: context.organizationId, title: body.normalizedTitle, privateToken: "server-only-secret" },
			}),
			"GET /organizations/:organizationId/notes/:noteId": ({ params }) =>
				params.noteId === 404
					? { status: 404, body: { error: "not_found" } }
					: {
							status: 200,
							body: { id: params.noteId, title: "Saved note", privateToken: "server-only-secret" },
						},
			"DELETE /organizations/:organizationId/notes/:noteId": ({ params }) =>
				params.noteId === 404 ? { status: 404, body: { error: "not_found" } } : { status: 204 },
		},
	});

	const client = createClient<typeof notesAPI>({
		baseURL: "https://notes.example.test/",
		fetch: (input, initialization) => handle(new Request(input, initialization)),
	});

	return { client, contexts, handle };
}

describe("HTTP contract client/server conformance", () => {
	it("shares typed route codecs, repeated search values, and trusted request/response transforms", async () => {
		const { client, contexts } = connectedAPI();
		const listed = await client.GET(notesRoute.path, {
			params: { organizationId: 42 },
			search: { tag: ["release", "security"] },
		});

		expect(isStatus(listed, 200)).toBe(true);
		if (isStatus(listed, 200)) {
			expect(listed.data).toEqual([{ id: 42, title: "42:release,security" }]);
		}

		const created = await client.POST(notesRoute.path, {
			params: { organizationId: 42 },
			body: { title: "  Ship the API  " },
		});

		expect(isStatus(created, 201)).toBe(true);
		if (isStatus(created, 201)) {
			expect(created.data).toEqual({ id: 42, title: "Ship the API" });
		}

		expect(contexts).toHaveBeenCalledTimes(2);
	});

	it("preserves declared authorization, missing-resource, and bodyless outcomes", async () => {
		const { client, handle } = connectedAPI();

		const denied = await client.GET(notesRoute.path, {
			params: { organizationId: 42 },
			headers: { "x-denied": "true" },
		});

		expect(isStatus(denied, 401)).toBe(true);
		if (isStatus(denied, 401)) {
			expect(denied.error).toEqual({ error: "unauthorized" });
		}

		const missing = await client.GET(noteRoute.path, { params: { organizationId: 42, noteId: 404 } });

		expect(isStatus(missing, 404)).toBe(true);

		const removed = await client.DELETE(noteRoute.path, { params: { organizationId: 42, noteId: 7 } });

		expect(isStatus(removed, 204)).toBe(true);
		if (isStatus(removed, 204)) {
			expect(removed.data).toBeUndefined();
		}

		const unread = new Request("https://notes.example.test/organizations/42/notes", {
			method: "POST",
			headers: { "content-type": "application/json", "x-denied": "true" },
			body: JSON.stringify({ title: "never read this" }),
		});

		expect((await handle(unread)).status).toBe(401);
		expect(unread.bodyUsed).toBe(false);
	});

	it("keeps middleware and gateway statuses honest without misclassifying raw payloads", async () => {
		const gateway = createClient<typeof notesAPI>({
			baseURL: "https://notes.example.test/",
			fetch: async () => Response.json({ error: "rate_limited" }, { status: 429 }),
		});

		const limited = await gateway.GET(notesRoute.path, { params: { organizationId: 42 } });

		expect(limited.status).toBe(429);
		expect(isStatus(limited, 400)).toBe(false);
		expect(isStatus(limited, 401)).toBe(false);

		const html = createClient<typeof notesAPI>({
			baseURL: "https://notes.example.test/",
			fetch: async () =>
				new Response("<h1>Bad Gateway</h1>", {
					status: 502,
					headers: { "content-type": "text/html" },
				}),
		});

		const failed = await html.GET(notesRoute.path, { params: { organizationId: 42 } });

		expect(failed.kind).toBe("raw");
		expect(failed.status).toBe(502);
		expect(await failed.response.text()).toBe("<h1>Bad Gateway</h1>");

		const malformed = createClient<typeof notesAPI>({
			baseURL: "https://notes.example.test/",
			fetch: async () =>
				new Response("not json", {
					status: 502,
					headers: { "content-type": "application/json" },
				}),
		});

		const invalid = await malformed.GET(notesRoute.path, { params: { organizationId: 42 } });

		expect(invalid).toMatchObject({ kind: "raw", status: 502, body: "not json" });
	});

	it("projects only public response fields into OpenAPI", () => {
		const document = toOpenAPI(notesAPI, { info: { title: "Notes API", version: "1.0.0" } });
		const created = document.paths["/organizations/{organizationId}/notes"]?.post;

		expect(created?.responses["201"]?.content?.["application/json"].schema).toEqual({
			type: "object",
			properties: { id: { type: "integer" }, title: { type: "string" } },
		});

		expect(JSON.stringify(document)).not.toContain("privateToken");
		expect(JSON.stringify(document)).not.toContain("server-only-secret");
	});
});
