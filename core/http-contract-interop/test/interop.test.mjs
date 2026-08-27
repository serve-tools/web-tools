import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { defineAPI } from "@serve-tools/http-contract";
import { toOpenAPI } from "@serve-tools/http-contract/openapi";
import { createHandler } from "@serve-tools/http-contract/server";
import { codec, route } from "@serve-tools/router";
import createClient from "openapi-fetch";
import openapiTS, { astToString } from "openapi-typescript";

const require = createRequire(import.meta.url);
const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const interopDirectory = resolve(fixtureDirectory, "..");

function schema(jsonSchema) {
	return {
		"~standard": {
			version: 1,
			vendor: "http-contract-interop",
			validate: (value) => ({ value }),
			jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
		},
	};
}

const itemInput = schema({
	type: "object",
	properties: { title: { type: "string" } },
	required: ["title"],
});
const itemOutput = schema({
	type: "object",
	properties: {
		id: { type: "integer" },
		title: { type: "string" },
		tags: { type: "array", items: { type: "string" } },
	},
	required: ["id", "title", "tags"],
});
const itemRoute = route("/items/:itemId", {
	params: { itemId: codec.integer() },
	search: { tag: codec.string().many() },
});
const api = defineAPI({
	routes: {
		[itemRoute.path]: {
			route: itemRoute,
			POST: { operationId: "replaceItem", body: itemInput, responses: { 200: itemOutput } },
		},
	},
});

const document = toOpenAPI(api, { info: { title: "Interop API", version: "1.0.0" } });

test("reproduces checked-in openapi-typescript declarations with the fixture compiler", async () => {
	const actual = astToString(await openapiTS(document));
	const expected = await readFile(resolve(interopDirectory, "generated/openapi.d.ts"), "utf8");

	assert.equal(actual, expected);
});

test("uses the fixture TypeScript 5 compiler for generated-client type checks", () => {
	const packagePath = require.resolve("typescript/package.json");
	const typeScript = require(packagePath);

	assert.equal(typeScript.version, "5.9.3");
	execFileSync(process.execPath, [resolve(dirname(packagePath), "bin/tsc"), "--project", "tsconfig.json"], {
		cwd: interopDirectory,
		stdio: "inherit",
	});
});

test("openapi-fetch sends generated path, repeated query, and JSON body to the contract handler", async () => {
	const handle = createHandler(api, {
		handlers: {
			"POST /items/:itemId": ({ body, params, search }) => ({
				status: 200,
				body: { id: params.itemId, title: body.title, tags: search.tag },
			}),
		},
	});
	const client = createClient({
		baseUrl: "https://interop.example.test",
		fetch: (input, initialization) => handle(new Request(input, initialization)),
	});
	const result = await client.POST("/items/{itemId}", {
		params: { path: { itemId: 7 }, query: { tag: ["first", "second"] } },
		body: { title: "Saved" },
	});

	assert.equal(result.response.status, 200);
	assert.deepEqual(result.data, { id: 7, title: "Saved", tags: ["first", "second"] });
});
