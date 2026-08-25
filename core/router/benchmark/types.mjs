import { existsSync } from "node:fs";
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
const sourceEntry = path.join(root, "core", "router", "src", "router.js");
const installedEntry = path.join(root, "core", "router", "dist", "router.js");
const installedDeclaration = path.join(root, "core", "router", "dist", "router.d.ts");
const { counts: routes, editor } = parseBenchmarkOptions({
	arguments_: process.argv.slice(2),
	countFlag: "--routes",
	defaultCounts: "25,100,250,500",
	environment: "ROUTER_BENCHMARK_ROUTES",
	help: "Usage: npm run benchmark:types -- [--routes 25,100,250,500] [--editor]",
	label: "route counts",
});

const scenarios = [
	"control",
	"source-import",
	...(existsSync(installedEntry) && existsSync(installedDeclaration) ? ["installed-import"] : []),
	"route-declaration",
	"href-use",
	"extraction",
	"codec-options",
	"loader-context",
];

if (!existsSync(installedEntry) || !existsSync(installedDeclaration)) {
	console.log(
		"[benchmark:types] installed declarations are unavailable; build core/router to include the installed-import baseline",
	);
}

await withTemporaryRoot("router", async (temporaryRoot) => {
	for (const routeCount of routes) {
		for (const scenario of scenarios) {
			const fixture = await createFixture(temporaryRoot, routeCount, scenario);
			const metrics = compileTypeScript({
				compiler: typescript.compiler,
				configuration: fixture.configuration,
				root,
			});
			const record = {
				name: `router/types/${scenario}`,
				scenario,
				routes: routeCount,
				workload: routeCount <= 100 ? "representative" : "stress",
				typescript: typescriptVersion,
				...metrics,
			};

			console.log(`[benchmark:types] ${JSON.stringify(record)}`);

			if (editor && (scenario === "href-use" || scenario === "codec-options" || scenario === "loader-context")) {
				await benchmarkEditor(temporaryRoot, fixture, routeCount, scenario);
			}
		}
	}
});

async function createFixture(temporaryRoot, count, scenario) {
	const stem = `${scenario}-${count}`;
	const source = path.join(temporaryRoot, `${stem}.ts`);
	const configuration = path.join(temporaryRoot, `${stem}.json`);
	const entry = scenario === "installed-import" ? installedEntry : sourceEntry;
	const contents = `${fixtureSections(count, scenario, entry).join("\n")}\n`;
	const config = {
		extends: path.join(root, "tsconfig.json"),
		compilerOptions: {
			composite: false,
			declaration: false,
			incremental: false,
			lib: ["ES2025", "DOM", "DOM.Iterable"],
			noEmit: true,
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

function fixtureSections(count, scenario, entry) {
	if (scenario === "control") {
		return [
			`const routeCount = ${count};`,
			'const labels = Array.from({ length: routeCount }, (_, index) => "route-" + index);',
			"void labels;",
		];
	}

	const typeOnly = scenario === "source-import" || scenario === "installed-import";
	if (typeOnly) {
		return [
			`import type { AnyRoute, Codec, Route, RouteData, RouteInput, RouteMatch, RouteParams, RouteSearch } from ${JSON.stringify(entry)};`,
			"type PublicRouterTypes = [AnyRoute, Codec<string>, Route, RouteData<AnyRoute>, RouteInput<AnyRoute>, RouteMatch, RouteParams<AnyRoute>, RouteSearch<AnyRoute>];",
			"declare const imported: PublicRouterTypes;",
			"void imported;",
		];
	}

	const routes = createRoutes(count, scenario === "loader-context");
	const sections = [
		`import { codec, route } from ${JSON.stringify(entry)};`,
		...(scenario === "extraction"
			? [
					`import type { RouteData, RouteInput, RouteMatch, RouteParams, RouteSearch } from ${JSON.stringify(entry)};`,
				]
			: []),
		...routes.declarations,
		`const routes = [${routes.names.join(", ")}] as const;`,
	];

	if (scenario === "route-declaration") {
		sections.push("void routes;");
	} else if (scenario === "href-use") {
		sections.push(...routes.hrefs, ...hrefCompletionFixture());
	} else if (scenario === "extraction") {
		sections.push(
			"type RouteExtractions = {",
			'\treadonly [Value in (typeof routes)[number] as Value["path"]]: {',
			"\t\treadonly params: RouteParams<Value>;",
			"\t\treadonly search: RouteSearch<Value>;",
			"\t\treadonly input: RouteInput<Value>;",
			"\t\treadonly data: RouteData<Value>;",
			"\t\treadonly match: RouteMatch<Value> | null;",
			"\t};",
			"};",
			"declare const extractions: RouteExtractions;",
			"void extractions;",
		);
	} else if (scenario === "codec-options") {
		sections.push(...codecCompletionFixture());
	} else {
		sections.push("void routes;");
	}

	return sections;
}

function createRoutes(count, withLoaders) {
	const declarations = [];
	const hrefs = [];
	const names = [];

	for (let index = 0; index < count; ++index) {
		const name = `route${index}`;
		const shape = index % 4;
		names.push(name);

		if (shape === 0) {
			declarations.push(
				`const ${name} = route("/teams/:teamId/projects/${index}", { params: { teamId: codec.integer() }, search: { page: codec.integer(), view: codec.enum("board", "list").default("board"), q: codec.string().optional() }${loading(withLoaders, "teamId", "page")} });`,
			);
			hrefs.push(`void ${name}.href({ params: { teamId: ${index} }, search: { page: ${index} } });`);
		} else if (shape === 1) {
			declarations.push(
				`const ${name} = route("/assets/${index}/:id.:format-:variant", { params: { id: codec.string() }, search: { download: codec.enum("inline", "attachment").default("inline"), tag: codec.string().many() }${loading(withLoaders, "id", "download")} });`,
			);
			hrefs.push(
				`void ${name}.href({ params: { id: "asset-${index}", format: "svg", variant: "dark" }, search: { tag: ["icons"] } });`,
			);
		} else if (shape === 2) {
			declarations.push(
				`const ${name} = route("/organizations/:organizationId/sections/${index}/:section", { params: { organizationId: codec.integer() }, search: { expanded: codec.enum("yes", "no").optional(), filters: codec.string().many() }${loading(withLoaders, "organizationId", "expanded")} });`,
			);
			hrefs.push(
				`void ${name}.href({ params: { organizationId: ${index}, section: "overview" }, search: { filters: ["recent"] } });`,
			);
		} else {
			declarations.push(
				`const ${name} = route("/browse/:kind/${index}/:slug", { params: { kind: codec.enum("new", "popular", "featured") }, search: { sort: codec.enum("name", "date").default("date"), limit: codec.integer().default(20), tags: codec.string().many().optional() }${loading(withLoaders, "kind", "sort")} });`,
			);
			hrefs.push(`void ${name}.href({ params: { kind: "featured", slug: "route-${index}" } });`);
		}
	}

	return { declarations, hrefs, names };
}

function loading(enabled, parameter, search) {
	if (!enabled) {
		return "";
	}

	return `, loading: { mode: "blocking", load: ({ /* loader-context */ params, search, url, signal }) => { void params.${parameter}; void search.${search}; void url; void signal; return { ${parameter}: params.${parameter}, ${search}: search.${search} }; } }`;
}

function hrefCompletionFixture() {
	return [
		'const hrefTarget = route("/editor/:teamId/:slug", {',
		"\tparams: { teamId: codec.integer() },",
		'\tsearch: { page: codec.integer(), view: codec.enum("board", "list").default("board"), tags: codec.string().many() },',
		"});",
		"void hrefTarget.href({",
		'\tparams: { /* href-params */ teamId: 1, slug: "editor" },',
		'\tsearch: { /* href-search */ page: 1, tags: ["typed"] },',
		"});",
		'const enumTarget = route("/editor/:kind", { params: { kind: codec.enum("new", "popular", "featured") } });',
		'void enumTarget.href({ params: { kind: /* href-enum-value */ "featured" } });',
	];
}

function codecCompletionFixture() {
	return [
		"const integer = codec.integer();",
		"const optional = codec.string().optional();",
		'const defaulted = codec.enum("one", "two").default("one");',
		"const repeated = codec.string().many();",
		"const editorCodec = codec.integer()./* codec-method */default(1);",
		"void [integer, optional, defaulted, repeated, editorCodec, routes];",
	];
}

async function benchmarkEditor(temporaryRoot, fixture, routes, scenario) {
	const record = await withNativeEditor({
		editor: typescript.editor,
		fixture,
		projectError: "The TypeScript editor did not load the router benchmark project",
		root,
		run: ({ api, project }) => {
			const { result: diagnostics, timing: diagnosticTiming } = timeEditorRequest(api, () =>
				project.program.getSemanticDiagnostics(fixture.source),
			);
			if (diagnostics.length !== 0) {
				throw new Error(`The TypeScript editor reported ${diagnostics.length} semantic diagnostics`);
			}

			const completions = editorCompletions({ api, fixture, project, scenario });
			const profile = api.internal.saveHeapProfile(temporaryRoot);
			const nativeHeapBytes = readNativeHeap({ profile, root, sample: "inuse_space" });
			const nativeAllocatedBytes = readNativeHeap({ profile, root, sample: "alloc_space" });

			return {
				name: `router/types/editor/${scenario}`,
				scenario,
				routes,
				workload: routes <= 100 ? "representative" : "stress",
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
				completionRequests: completions.map(({ expected, name, result, timing }) => ({
					expected,
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

function editorCompletions({ api, fixture, project, scenario }) {
	const requests =
		scenario === "href-use"
			? [
					["href-params", "/* href-params */", "teamId"],
					["href-search", "/* href-search */", "page"],
					["href-enum-value", "/* href-enum-value */", "featured"],
				]
			: scenario === "codec-options"
				? [["codec-method", "/* codec-method */", "default"]]
				: [["loader-context", "/* loader-context */", "params"]];

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

		return { expected, name, ...completion };
	});
}
