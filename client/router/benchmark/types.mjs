import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(import.meta.url);
const typescriptRoot = path.dirname(require.resolve("typescript/package.json"));
const typescriptVersion = require("typescript/package.json").version;
const compiler = path.join(typescriptRoot, "bin", "tsc");
const coreSource = path.join(root, "core", "router", "src", "router.js");
const clientSource = path.join(root, "client", "router", "src", "client-router.js");
const options = parseOptions(process.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "serve-tools-router-types-"));

try {
	for (const routes of options.routes) {
		const results = new Map();

		for (const scenario of ["declarations", "installed", "navigation"]) {
			const fixture = await createFixture(routes, scenario);
			const metrics = compile(fixture.configuration);
			const installed = results.get("installed");
			const record = {
				name: `client-router/types/${scenario}`,
				scenario,
				routes,
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

			if (options.editor && scenario === "navigation") {
				await benchmarkEditor(fixture, routes);
			}
		}
	}
} finally {
	await rm(temporaryRoot, { recursive: true, force: true });
}

function parseOptions(arguments_) {
	const options = {
		editor: false,
		routes: parseRouteCounts(process.env.ROUTER_BENCHMARK_ROUTES ?? "25,100,250"),
	};

	for (let index = 0; index < arguments_.length; ++index) {
		const argument = arguments_[index];

		if (argument === "--editor") {
			options.editor = true;
			continue;
		}

		if (argument === "--routes") {
			const value = arguments_[++index];
			if (value === undefined) {
				throw new TypeError("--routes requires comma-separated positive route counts");
			}

			options.routes = parseRouteCounts(value);
			continue;
		}

		if (argument === "--help" || argument === "-h") {
			console.log("Usage: npm run benchmark:types -- [--routes 25,100,250] [--editor]");
			process.exit(0);
		}

		throw new TypeError(`Unknown benchmark option: ${argument}`);
	}

	return options;
}

function parseRouteCounts(value) {
	const counts = value.split(",").map((count) => Number(count.trim()));

	if (counts.length === 0 || counts.some((count) => !Number.isSafeInteger(count) || count < 1)) {
		throw new TypeError("Route counts must be comma-separated positive integers");
	}

	return counts;
}

async function createFixture(count, scenario) {
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
		...(scenario === "declarations" ? ["void routes;"] : ["const router = createRouter({ routes });"]),
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

function compile(configuration) {
	const result = spawnSync(
		process.execPath,
		[compiler, "--project", configuration, "--noEmit", "--extendedDiagnostics", "--pretty", "false"],
		{ cwd: root, encoding: "utf8" },
	);

	if (result.error !== undefined) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`TypeScript benchmark failed:\n${result.stdout}${result.stderr}`);
	}

	return {
		instantiations: readDiagnostic(result.stdout, "Instantiations"),
		memoryAllocations: readDiagnostic(result.stdout, "Memory allocs"),
		memoryKilobytes: readDiagnostic(result.stdout, "Memory used"),
		checkMilliseconds: readDiagnostic(result.stdout, "Check time") * 1_000,
	};
}

function readDiagnostic(output, name) {
	const match = new RegExp(`^${name}:\\s*([\\d,.]+)(?:K|s)?\\s*$`, "m").exec(output);

	if (match === null) {
		throw new Error(`TypeScript did not report the expected ${name} diagnostic`);
	}

	return Number(match[1].replaceAll(",", ""));
}

async function benchmarkEditor(fixture, routes) {
	const { API } = await import("typescript/unstable/sync");
	const api = new API({ cwd: root, collectTiming: true });
	let snapshot;

	try {
		snapshot = api.updateSnapshot({ openProjects: [fixture.configuration], openFiles: [fixture.source] });
		const project = snapshot.getProject(fixture.configuration);
		if (project === undefined) {
			throw new Error("The TypeScript editor did not load the benchmark project");
		}

		api.resetTimingInfo();
		const diagnostics = project.program.getSemanticDiagnostics(fixture.source);
		const diagnosticTiming = api.getTimingInfo();
		if (diagnostics.length !== 0) {
			throw new Error(`The TypeScript editor reported ${diagnostics.length} semantic diagnostics`);
		}

		api.resetTimingInfo();
		const position = fixture.contents.indexOf("/* editor-completion */");
		const completions = project.checker.getCompletionsAtPosition(fixture.source, position);
		const completionTiming = api.getTimingInfo();
		if (!completions?.entries.some((entry) => entry.name === "navigate")) {
			throw new Error("The TypeScript editor did not provide the expected router completion");
		}

		const profile = api.internal.saveHeapProfile(temporaryRoot);
		const nativeHeapBytes = readNativeHeap(profile, "inuse_space");
		const nativeAllocatedBytes = readNativeHeap(profile, "alloc_space");
		const record = {
			name: "client-router/types/editor",
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

		console.log(`[benchmark:types] ${JSON.stringify(record)}`);
	} finally {
		snapshot?.dispose();
		api.close();
	}
}

function readNativeHeap(profile, sample) {
	const result = spawnSync(
		"go",
		["tool", "pprof", "-top", "-nodecount=1", "-unit=B", `-sample_index=${sample}`, profile],
		{
			cwd: root,
			encoding: "utf8",
		},
	);

	if (result.error?.code === "ENOENT") {
		return null;
	}
	if (result.error !== undefined) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`Could not inspect the TypeScript server heap:\n${result.stderr}`);
	}

	const match = /of\s+([\d,]+)B\s+total/.exec(result.stdout);
	if (match === null) {
		throw new Error("Could not locate native heap bytes in the Go heap profile");
	}

	return Number(match[1].replaceAll(",", ""));
}
