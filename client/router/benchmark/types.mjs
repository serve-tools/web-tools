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
const coreSource = path.join(root, "core", "router", "src", "router.js");
const clientSource = path.join(root, "client", "router", "src", "client-router.js");
const { counts: routes, editor } = parseBenchmarkOptions({
	arguments_: process.argv.slice(2),
	countFlag: "--routes",
	defaultCounts: "25,100,250",
	environment: "ROUTER_BENCHMARK_ROUTES",
	help: "Usage: npm run benchmark:types -- [--routes 25,100,250] [--editor]",
	label: "route counts",
});

await withTemporaryRoot("router", async (temporaryRoot) => {
	for (const routeCount of routes) {
		const results = new Map();

		for (const scenario of ["declarations", "installed", "navigation", "interception"]) {
			const fixture = await createFixture(temporaryRoot, routeCount, scenario);
			const metrics = compileTypeScript({
				compiler: typescript.compiler,
				configuration: fixture.configuration,
				root,
			});
			const installed = results.get("installed");
			const record = {
				name: `client-router/types/${scenario}`,
				scenario,
				routes: routeCount,
				typescript: typescriptVersion,
				...metrics,
				...(scenario === "navigation" && installed !== undefined
					? {
							navigationAllocationRatio: Number(
								(metrics.memoryAllocations / installed.memoryAllocations).toFixed(3),
							),
							navigationInstantiationDelta: metrics.instantiations - installed.instantiations,
						}
					: {}),
			};

			results.set(scenario, record);
			console.log(`[benchmark:types] ${JSON.stringify(record)}`);

			if (editor && (scenario === "navigation" || scenario === "interception")) {
				await benchmarkEditor(temporaryRoot, fixture, routeCount, scenario);
			}
		}
	}
});

async function createFixture(temporaryRoot, count, scenario) {
	const stem = `${scenario}-${count}`;
	const source = path.join(temporaryRoot, `${stem}.ts`);
	const configuration = path.join(temporaryRoot, `${stem}.json`);
	const declarations = [];
	const navigations = [];

	for (let index = 0; index < count; ++index) {
		const name = `route${index}`;
		const shape = index % 4;

		if (shape === 0) {
			declarations.push(
				`const ${name} = route("/teams/:teamId/projects/${index}", { params: { teamId: codec.integer() }, search: { page: codec.integer().default(1) }, loading: { mode: "blocking", load: ({ params }) => ({ team: params.teamId }) } });`,
			);
			navigations.push(`router.navigate(${name}, { params: { teamId: ${index} }, search: { page: 1 } });`);
		} else if (shape === 1) {
			declarations.push(
				`const ${name} = route("/people/${index}/:slug", { params: { slug: codec.string() }, search: { status: codec.enum("draft", "published").default("draft") }, loading: { mode: "deferred", load: ({ search }) => ({ status: search.status }) } });`,
			);
			navigations.push(`router.navigate(${name}, { params: { slug: "person-${index}" } });`);
		} else if (shape === 2) {
			declarations.push(
				`const ${name} = route("/catalog/${index}/:sku", { params: { sku: codec.string() }, search: { tags: codec.string().many(), query: codec.string().optional() } });`,
			);
			navigations.push(
				`router.navigate(${name}, { params: { sku: "sku-${index}" }, search: { tags: ["new"] } });`,
			);
		} else {
			declarations.push(
				`const ${name} = route("/organizations/:organizationId/sections/${index}/:section", { params: { organizationId: codec.integer() }, search: { expanded: codec.enum("yes", "no").optional() } });`,
			);
			navigations.push(
				`router.navigate(${name}, { params: { organizationId: ${index}, section: "overview" } });`,
			);
		}
	}

	const sections = [
		`import { codec, route } from ${JSON.stringify(coreSource)};`,
		...(scenario === "declarations" ? [] : [`import { createRouter } from ${JSON.stringify(clientSource)};`]),
		...declarations,
		`const routes = [${Array.from({ length: count }, (_, index) => `route${index}`).join(", ")}] as const;`,
		...(scenario === "declarations"
			? ["void routes;"]
			: scenario === "interception"
				? [
						"const router = createRouter({ routes, shouldIntercept({ match }) {",
						"  if (match?.path !== route0.path) return true;",
						"  const teamId: number = match.params./* editor-completion */teamId;",
						"  const page: number = match.search.page;",
						"  return teamId > 0 && page > 0;",
						"} });",
					]
				: ["const router = createRouter({ routes });"]),
		...(scenario === "navigation" ? navigations : []),
		...(scenario === "navigation" ? ["router./* editor-completion */navigate;"] : []),
		...(scenario === "installed" ? ["void router;"] : []),
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
			paths: { "@serve-tools/router": [path.join(root, "core", "router", "src", "router.ts")] },
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

async function benchmarkEditor(temporaryRoot, fixture, routes, scenario) {
	const record = await withNativeEditor({
		editor: typescript.editor,
		fixture,
		projectError: "The TypeScript editor did not load the benchmark project",
		root,
		run: ({ api, project }) => {
			const { result: diagnostics, timing: diagnosticTiming } = timeEditorRequest(api, () =>
				project.program.getSemanticDiagnostics(fixture.source),
			);
			if (diagnostics.length !== 0) {
				throw new Error(`The TypeScript editor reported ${diagnostics.length} semantic diagnostics`);
			}

			const position = fixture.contents.indexOf("/* editor-completion */");
			const { result: completions, timing: completionTiming } = timeEditorRequest(api, () =>
				project.checker.getCompletionsAtPosition(fixture.source, position),
			);
			const expectedCompletion = scenario === "interception" ? "teamId" : "navigate";
			if (!completions?.entries.some((entry) => entry.name === expectedCompletion)) {
				throw new Error("The TypeScript editor did not provide the expected router completion");
			}

			const profile = api.internal.saveHeapProfile(temporaryRoot);
			const nativeHeapBytes = readNativeHeap({ profile, root, sample: "inuse_space" });
			const nativeAllocatedBytes = readNativeHeap({ profile, root, sample: "alloc_space" });
			return {
				name: "client-router/types/editor",
				scenario,
				routes,
				typescript: typescriptVersion,
				diagnosticServerMilliseconds: diagnosticTiming.totals.serverTimeMs,
				diagnosticRoundTripMilliseconds: diagnosticTiming.totals.roundTripMs,
				completionServerMilliseconds: completionTiming.totals.serverTimeMs,
				completionRoundTripMilliseconds: completionTiming.totals.roundTripMs,
				completionCount: completions.entries.length,
				nativeHeapBytes,
				nativeAllocatedBytes,
			};
		},
	});

	console.log(`[benchmark:types] ${JSON.stringify(record)}`);
}
