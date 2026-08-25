import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileTypeScript,
	parseBenchmarkOptions,
	readNativeHeap,
	resolveTypeScript,
	timeEditorRequest,
	withNativeEditor,
	withTemporaryRoot,
} from "../../../benchmark/typescript/harness.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const typescript = resolveTypeScript(root);
const typescriptVersion = typescript.version;
const contractSource = path.join(root, "core", "http-contract", "src", "http-contract.js");
const clientSource = path.join(root, "core", "http-contract", "src", "client.js");
const serverSource = path.join(root, "core", "http-contract", "src", "server.js");
const routerSource = path.join(root, "core", "router", "src", "router.js");
const { counts: operations, editor } = parseBenchmarkOptions({
	arguments_: process.argv.slice(2),
	countFlag: "--operations",
	defaultCounts: "25,100,250,500",
	environment: "HTTP_CONTRACT_BENCHMARK_OPERATIONS",
	help: "Usage: npm run benchmark:types -- [--operations 25,100,250,500] [--editor]",
	label: "operation counts",
});

const scenarios = [
	"contract-declaration",
	"client-construction",
	"client-use",
	"selected-route",
	"selected-params",
	"status-narrowing",
	"server-context",
];

await withTemporaryRoot("http-contract", async (temporaryRoot) => {
	for (const operationCount of operations) {
		for (const scenario of scenarios) {
			const fixture = await createFixture(temporaryRoot, operationCount, scenario);
			const metrics = compileTypeScript({
				compiler: typescript.compiler,
				configuration: fixture.configuration,
				root,
			});
			const record = {
				name: `http-contract/types/${scenario}`,
				scenario,
				operations: operationCount,
				typescript: typescriptVersion,
				...metrics,
			};

			console.log(`[benchmark:types] ${JSON.stringify(record)}`);

			if (
				editor &&
				(scenario === "selected-route" || scenario === "selected-params" || scenario === "server-context")
			) {
				await benchmarkEditor(temporaryRoot, fixture, operationCount, scenario);
			}
		}
	}
});

async function createFixture(temporaryRoot, count, scenario) {
	const stem = `${scenario}-${count}`;
	const source = path.join(temporaryRoot, `${stem}.ts`);
	const configuration = path.join(temporaryRoot, `${stem}.json`);
	const routes = createRoutes(count);
	const sections = [
		`import type { StandardSchemaV1 } from "@standard-schema/spec";`,
		`import { defineAPI } from ${JSON.stringify(contractSource)};`,
		`import { codec, route } from ${JSON.stringify(routerSource)};`,
		standardSchemaFixture(),
		...routes.declarations,
		`const api = defineAPI({ commonResponses: { 400: invalidRequest, 404: missing }, routes: { ${routes.contracts.join(", ")} } });`,
		...scenarioSections(scenario, routes.handlers),
	];
	const contents = `${sections.join("\n")}\n`;
	const config = {
		extends: path.join(root, "tsconfig.json"),
		compilerOptions: {
			composite: false,
			declaration: false,
			incremental: false,
			lib: ["ES2025", "DOM", "DOM.Iterable"],
			noEmit: true,
			paths: {
				"@standard-schema/spec": [
					path.join(root, "node_modules", "@standard-schema", "spec", "dist", "index.d.ts"),
				],
				"@serve-tools/http-contract": [path.join(root, "core", "http-contract", "src", "http-contract.ts")],
				"@serve-tools/http-contract/client": [path.join(root, "core", "http-contract", "src", "client.ts")],
				"@serve-tools/http-contract/server": [path.join(root, "core", "http-contract", "src", "server.ts")],
				"@serve-tools/router": [path.join(root, "core", "router", "src", "router.ts")],
			},
			skipLibCheck: true,
			strict: true,
			types: [],
		},
		files: [source],
		include: [],
	};

	await Promise.all([
		writeFile(source, contents),
		writeFile(configuration, `${JSON.stringify(config, undefined, "\t")}\n`),
	]);

	return { configuration, contents, source };
}

function standardSchemaFixture() {
	return [
		"const schema = <Input, Output = Input>(): StandardSchemaV1<Input, Output> => ({",
		'\t"~standard": {',
		"\t\tversion: 1,",
		'\t\tvendor: "benchmark",',
		"\t\tvalidate(value) {",
		"\t\t\treturn { value: value as Output };",
		"\t\t},",
		"\t},",
		"});",
		"",
		"type NoteInput = { readonly title: string; readonly content: string };",
		"type Note = NoteInput & { readonly id: number };",
		"const note = schema<NoteInput, Note>();",
		'const invalidRequest = schema<{ readonly error: "invalid_request" }>();',
		'const missing = schema<{ readonly error: "not_found" }>();',
		"",
	].join("\n");
}

function createRoutes(count) {
	const declarations = [];
	const contracts = [];
	const handlers = [];

	for (let index = 0; index < count; ++index) {
		const name = `route${index}`;
		const shape = index % 4;
		let path;
		let definition;
		let operation;

		if (shape === 0) {
			path = `/reports/${index}`;
			definition = "";
			operation = `GET: { operationId: "getReport${index}", responses: { 200: note } }`;
			handlers.push(
				`${JSON.stringify(`GET ${path}`)}: () => ({ status: 200, body: { id: ${index}, title: "Report", content: "Body" } }),`,
			);
		} else if (shape === 1) {
			path = `/profiles/${index}/:profileId`;
			definition = ", { params: { profileId: codec.integer() }, search: { page: codec.integer().default(1) } }";
			operation = `GET: { operationId: "getProfile${index}", responses: { 200: note } }`;
			handlers.push(
				index === 1
					? `${JSON.stringify(`GET ${path}`)}: ({ /* handler-completion */ params, search, request, signal, context }) => { params.profileId.toFixed(); search.page?.toFixed(); void request; void signal; void context; return { status: 200, body: { id: params.profileId, title: "Profile", content: "Body" } }; },`
					: `${JSON.stringify(`GET ${path}`)}: ({ params }) => ({ status: 200, body: { id: params.profileId, title: "Profile", content: "Body" } }),`,
			);
		} else if (shape === 2) {
			path = `/organizations/:organizationId/notes/${index}`;
			definition =
				", { params: { organizationId: codec.integer() }, search: { query: codec.string().optional() } }";
			operation = `POST: { operationId: "createNote${index}", body: note, responses: { 201: note } }`;
			handlers.push(
				`${JSON.stringify(`POST ${path}`)}: ({ params, body }) => ({ status: 201, body: { id: params.organizationId, title: body.title, content: body.content } }),`,
			);
		} else {
			path = `/projects/:projectId/notes/${index}/:noteId`;
			definition =
				", { params: { projectId: codec.integer(), noteId: codec.integer() }, search: { tags: codec.string().many() } }";
			operation = `DELETE: { operationId: "deleteNote${index}", responses: { 204: null } }`;
			handlers.push(`${JSON.stringify(`DELETE ${path}`)}: () => ({ status: 204 }),`);
		}

		declarations.push(`const ${name} = route(${JSON.stringify(path)}${definition});`);
		contracts.push(`[${name}.path]: { route: ${name}, serialization: "native", ${operation} }`);
	}

	return { contracts, declarations, handlers };
}

function scenarioSections(scenario, handlers) {
	const client = [
		`import { createClient, isStatus } from ${JSON.stringify(clientSource)};`,
		'const client = createClient<typeof api>({ baseURL: "https://api.example.test/" });',
	];

	if (scenario === "contract-declaration") {
		return ["void api;"];
	}
	if (scenario === "client-construction") {
		return [...client, "void client;"];
	}
	if (scenario === "client-use") {
		return [
			...client,
			'void client.GET("/reports/0");',
			'void client.POST("/organizations/:organizationId/notes/2", { params: { organizationId: 2 }, body: { title: "Note", content: "Body" } });',
			'void client.DELETE("/projects/:projectId/notes/3/:noteId", { params: { projectId: 3, noteId: 4 }, search: { tags: ["new", "shared"] } });',
		];
	}
	if (scenario === "selected-route") {
		return [
			...client,
			'void client.GET(/* get-route-completion */ "/reports/0");',
			'void client.POST(/* post-route-completion */ "/organizations/:organizationId/notes/2", { params: { organizationId: 2 }, body: { title: "Note", content: "Body" } });',
		];
	}
	if (scenario === "selected-params") {
		return [
			...client,
			'void client.GET("/profiles/1/:profileId", { params: { /* parameter-completion */ profileId: 1 }, search: { page: 1 } });',
		];
	}
	if (scenario === "status-narrowing") {
		return [
			...client,
			"async function selectedStatus() {",
			'\tconst result = await client.POST("/organizations/:organizationId/notes/2", { params: { organizationId: 2 }, body: { title: "Note", content: "Body" } });',
			"\tif (isStatus(result, 201)) return result.data.id;",
			"\tif (isStatus(result, 400)) return result.error.error;",
			"\tif (isStatus(result, 404)) return result.error.error;",
			"\treturn result.status;",
			"}",
			"void selectedStatus;",
		];
	}

	return [
		`import { createHandler } from ${JSON.stringify(serverSource)};`,
		"const handler = createHandler(api, {",
		"\thandlers: {",
		...handlers.map((handler) => `\t\t${handler}`),
		"\t},",
		"});",
		"void handler;",
	];
}

async function benchmarkEditor(temporaryRoot, fixture, operations, scenario) {
	const record = await withNativeEditor({
		editor: typescript.editor,
		fixture,
		projectError: "The TypeScript editor did not load the HTTP-contract benchmark project",
		root,
		run: ({ api, project }) => {
			const { result: diagnostics, timing: diagnosticTiming } = timeEditorRequest(api, () =>
				project.program.getSemanticDiagnostics(fixture.source),
			);
			if (diagnostics.length !== 0) {
				throw new Error(`The TypeScript editor reported ${diagnostics.length} semantic diagnostics`);
			}

			const completions = completionAt({ api, project, fixture, scenario });
			const profile = api.internal.saveHeapProfile(temporaryRoot);
			const nativeHeapBytes = readNativeHeap({ profile, root, sample: "inuse_space" });
			const nativeAllocatedBytes = readNativeHeap({ profile, root, sample: "alloc_space" });
			return {
				name: `http-contract/types/editor/${scenario}`,
				scenario,
				operations,
				typescript: typescriptVersion,
				diagnosticServerMilliseconds: diagnosticTiming.totals.serverTimeMs,
				diagnosticRoundTripMilliseconds: diagnosticTiming.totals.roundTripMs,
				completionServerMilliseconds: completions.reduce(
					(total, completion) => total + completion.timing.totals.serverTimeMs,
					0,
				),
				completionRoundTripMilliseconds: completions.reduce(
					(total, completion) => total + completion.timing.totals.roundTripMs,
					0,
				),
				completionCount: completions.reduce((total, completion) => total + completion.result.entries.length, 0),
				completionRequests: completions.map(({ name, result, timing }) => ({
					name,
					count: result.entries.length,
					serverMilliseconds: timing.totals.serverTimeMs,
					roundTripMilliseconds: timing.totals.roundTripMs,
				})),
				nativeHeapBytes,
				nativeAllocatedBytes,
			};
		},
	});

	console.log(`[benchmark:types] ${JSON.stringify(record)}`);
}

function completionAt({ api, fixture, project, scenario }) {
	const requests =
		scenario === "selected-route"
			? [
					["get-route", "/* get-route-completion */", "/reports/0"],
					["post-route", "/* post-route-completion */", "/organizations/:organizationId/notes/2"],
				]
			: scenario === "selected-params"
				? [["parameters", "/* parameter-completion */", "profileId"]]
				: [["handler-context", "/* handler-completion */", "params"]];

	return requests.map(([name, marker, expected]) => {
		const markerPosition = fixture.contents.indexOf(marker);
		if (markerPosition < 0) {
			throw new Error(`The ${name} completion marker was not found`);
		}
		let position = markerPosition + marker.length;
		while (/\s/.test(fixture.contents[position] ?? "")) {
			++position;
		}
		if (fixture.contents[position] === '"') {
			++position;
		}

		const completion = timeEditorRequest(api, () =>
			project.checker.getCompletionsAtPosition(fixture.source, position),
		);
		if (!completion.result?.entries.some((entry) => entry.name === expected)) {
			throw new Error(`The TypeScript editor did not provide the expected ${expected} completion`);
		}

		return { name, ...completion };
	});
}
