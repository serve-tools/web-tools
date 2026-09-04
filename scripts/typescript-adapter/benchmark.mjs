import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createServer, build as viteBuild } from "vite";
import { createBrowserFixture } from "./browser-fixture.mjs";
import { typescriptProject } from "./plugin.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const scriptFile = fileURLToPath(import.meta.url);
const compilerFile = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));
const resultMarker = "[typescript-adapter-benchmark] ";
const expectedCompilerVersion = "7.1.0-dev.20260904.1";
const timeoutMs = 15_000;

if (isEntrypoint()) {
	main().catch((error) => {
		console.error(error.stack ?? error);
		process.exitCode = 1;
	});
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	if (options.help) {
		console.log(usage());
		return;
	}
	if (options.smoke) {
		await smoke();
		return;
	}
	if (options.worker) {
		const result = await runCondition(options.worker, options.sample);
		console.log(`${resultMarker}${JSON.stringify(result)}`);
		return;
	}
	if (!options.run) {
		throw new Error(`Measured runs require --run.\n\n${usage()}`);
	}
	if (options.runs < 5) {
		throw new Error("Decision-grade execution requires at least five independent pairs");
	}

	const outputFile = path.resolve(options.output ?? defaultOutputFile());
	const record = {
		schemaVersion: 1,
		status: "running",
		scope: {
			fixture: "small referenced A-to-B-to-C fixture",
			claims: "Only this fixture, compiler, browser, bundler, machine, and command are measured.",
			excluded: [
				"real client/keyboard demo",
				"cross-platform watcher behavior",
				"network latency",
				"production runtime performance",
			],
		},
		method: {
			independentPairs: options.runs,
			order: "AB/BA counterbalanced by pair index; A is CLI disk and B is the in-memory adapter",
			browser: "Chromium, one fresh browser process per condition worker",
			concurrency: {
				cli: "--builders 4 --checkers 2",
				adapter: "TypeScript async API default; the adapter client configures no concurrency option",
				limitation:
					"The compared interfaces do not expose the same concurrency control, so concurrency is recorded but cannot be equalized by this harness.",
			},
			coldStartup:
				"fresh fixture with no compiler artifacts, then compiler, Vite server, and browser observation",
			noChangeStartup:
				"unchanged source after cold startup, then incremental CLI artifacts or a fresh adapter session, fresh Vite server, and browser observation",
			compilerCommand: [
				process.execPath,
				compilerFile,
				"--build",
				"tsconfig.json",
				"--builders",
				"4",
				"--checkers",
				"2",
				"--extendedDiagnostics",
			],
			waits: `observable browser state with ${timeoutMs} ms bounds; no fixed measurement sleeps`,
			outliers: "none removed",
			warmup: "none; cold and no-change startup are named workloads, and every condition uses a fresh worker",
		},
		command: [process.execPath, scriptFile, ...process.argv.slice(2)],
		environment: await environmentRecord(),
		sourceHashes: await sourceHashes(),
		startedAt: new Date().toISOString(),
		pairs: [],
	};
	await persist(outputFile, record);

	try {
		for (let pair = 0; pair < options.runs; ++pair) {
			const order = pair % 2 === 0 ? ["cli", "adapter"] : ["adapter", "cli"];
			const pairRecord = { pair: pair + 1, order, samples: {} };
			record.pairs.push(pairRecord);
			for (const condition of order) {
				pairRecord.samples[condition] = await runWorker(condition, pair + 1);
				await persist(outputFile, record);
			}
			pairRecord.parity = assertPairParity(pairRecord.samples);
			await persist(outputFile, record);
		}
		record.summary = summarize(record.pairs);
		record.status = "complete";
		record.finishedAt = new Date().toISOString();
		await persist(outputFile, record);
		console.log(outputFile);
	} catch (error) {
		record.status = "failed";
		record.finishedAt = new Date().toISOString();
		record.failure = error.stack ?? String(error);
		await persist(outputFile, record);
		throw new Error(`Benchmark failed; partial raw record saved to ${outputFile}`, { cause: error });
	}
}

async function smoke() {
	assert.equal((await packageVersion("typescript")).version, expectedCompilerVersion);
	const fixture = await createBrowserFixture();
	try {
		await fixture.assertNoDist();
		const inventory = await hashFixture(fixture.root);
		assert.ok(inventory.files.some(({ file }) => file === "a/src/index.ts"));
		assert.ok(inventory.files.some(({ file }) => file === "c/src/index.ts"));
		console.log("TypeScript adapter benchmark smoke passed (no measurements run).");
	} finally {
		await fixture.dispose();
	}
}

async function runCondition(condition, sample) {
	assert.ok(condition === "cli" || condition === "adapter", `Unknown condition ${condition}`);
	assert.ok(Number.isSafeInteger(sample) && sample > 0, "A positive integer --sample is required");
	assert.equal((await packageVersion("typescript")).version, expectedCompilerVersion);

	const fixture = await createBrowserFixture();
	let browser;
	let development;
	let processSampler;
	try {
		const initialFixture = await hashFixture(fixture.root);
		await fixture.assertNoDist();
		browser = await chromium.launch({ headless: true });
		const browserVersion = browser.version();
		const processBaseline = process.resourceUsage();
		processSampler = startProcessSampler();

		const cold = await startDevelopment({ browser, condition, fixture });
		await assertStorageMode(condition, fixture);
		await closeDevelopment(cold.development);

		const noChange = await startDevelopment({ browser, condition, fixture });
		development = noChange.development;
		await assertStorageMode(condition, fixture);

		const directEdit = await measureEdit({
			condition,
			development,
			fixture,
			mutate: () => fixture.writeImporter(2),
			expected: { asset: "prepared asset", decorator: "decorated", result: 11 },
			observedModule: "/a/dist/index.js",
		});
		const transitiveEdit = await measureEdit({
			condition,
			development,
			fixture,
			mutate: () => fixture.writeDependency(7),
			expected: { asset: "prepared asset", decorator: "decorated", result: 51 },
			observedModule: "/c/dist/index.js",
		});
		const configEdit = await measureEdit({
			condition,
			development,
			fixture,
			mutate: () => updateCompilerTarget(fixture.root, "c", "es2020"),
			expected: { asset: "prepared asset", decorator: "decorated", result: 51 },
			observedModule: "/c/dist/index.js",
			requireChangedModule: true,
		});

		const developmentStatistics = development.plugin?.api.statistics ?? null;
		const errors = development.errors;
		assert.deepEqual(errors.page, [], `Page errors:\n${errors.page.join("\n")}`);
		assert.deepEqual(errors.console, [], `Browser console errors:\n${errors.console.join("\n")}`);
		await closeDevelopment(development);
		development = undefined;
		await assertStorageMode(condition, fixture);

		const production = await measureProductionBuild(condition, fixture);
		const finalFixture = await hashFixture(fixture.root);
		const retained = await retainedProcesses();
		const sampledProcessPeaks = await processSampler.stop();
		processSampler = undefined;
		if (condition === "cli") {
			assert.equal(retained.compiler.count, 0, "CLI compiler process remained after its command completed");
		} else {
			assert.equal(retained.compiler.count, 0, "Disposed adapter compiler process remained after the sample");
		}

		return {
			condition,
			sample,
			browserVersion,
			fixture: { initial: initialFixture, final: finalFixture },
			workloads: {
				coldStartup: cold.measurement,
				noChangeStartup: noChange.measurement,
				directEdit,
				transitiveEdit,
				configEdit,
				production,
			},
			adapterFinalStatistics: developmentStatistics,
			memory: {
				nodeHostCurrentRssBytes: process.memoryUsage.rss(),
				nodeHostPeakRssBytes: process.resourceUsage().maxRSS * 1024,
				nodeHostPeakRssDeltaBytes: Math.max(0, process.resourceUsage().maxRSS - processBaseline.maxRSS) * 1024,
				retained,
				sampledProcessPeaks,
			},
		};
	} finally {
		await processSampler?.stop();
		await closeDevelopment(development);
		await browser?.close();
		await fixture.dispose();
	}
}

async function startDevelopment({ browser, condition, fixture }) {
	const started = performance.now();
	let compiler;
	let plugin;
	if (condition === "cli") {
		compiler = await runCompiler(fixture.root);
	} else {
		const compilerStarted = performance.now();
		plugin = await typescriptProject({ configFile: fixture.configFile, cwd: fixture.root });
		compiler = adapterCompilerMeasurement(plugin.api.statistics.compiler, performance.now() - compilerStarted);
	}
	const compilerFinished = performance.now();
	const server = await createServer(viteConfiguration(fixture.root, plugin));
	let page;
	const errors = { console: [], page: [] };
	try {
		await server.listen();
		page = await browser.newPage();
		page.on("console", (message) => {
			if (message.type() === "error") {
				errors.console.push(message.text());
			}
		});
		page.on("pageerror", (error) => errors.page.push(error.stack ?? error.message));
		await page.goto(serverOrigin(server), { waitUntil: "domcontentloaded" });
		await waitForBrowserState(page, { asset: "prepared asset", decorator: "decorated", result: 10 }, 1);
		const finished = performance.now();
		assert.deepEqual(errors.page, []);
		assert.deepEqual(errors.console, []);
		const resources = await browserResources(page);
		const afterStatistics = plugin?.api.statistics ?? null;
		return {
			measurement: {
				endToEndMs: finished - started,
				compiler,
				viteAndBrowserMs: finished - compilerFinished,
				browserResources: resources,
				hooks: hookMeasurement(null, afterStatistics),
				retained: await retainedProcesses(),
			},
			development: { errors, page, plugin, server, statistics: afterStatistics },
		};
	} catch (error) {
		await page?.close();
		await server.close();
		await plugin?.api.dispose();
		throw error;
	}
}

async function measureEdit({
	condition,
	development,
	fixture,
	mutate,
	expected,
	observedModule,
	requireChangedModule = false,
}) {
	const beforeStatistics = development.plugin?.api.statistics ?? null;
	const previousModuleText = requireChangedModule
		? await development.page.evaluate(
				async (url) => (await fetch(url, { cache: "no-store" })).text(),
				`${observedModule}?benchmark-before=${Date.now()}`,
			)
		: null;
	const browserResponse = development.page.waitForResponse(
		async (response) => {
			if (!new URL(response.url()).pathname.endsWith(observedModule) || !response.ok()) {
				return false;
			}
			return previousModuleText == null || (await response.text()) !== previousModuleText;
		},
		{ timeout: timeoutMs },
	);
	const started = performance.now();
	await mutate();
	let compiler;
	let compilerFinished;
	if (condition === "cli") {
		compiler = await runCompiler(fixture.root);
		compilerFinished = performance.now();
	}
	await Promise.all([browserResponse, waitForBrowserState(development.page, expected)]);
	const finished = performance.now();
	const afterStatistics = development.plugin?.api.statistics ?? null;
	if (condition === "adapter") {
		compiler = adapterCompilerMeasurement(afterStatistics.compiler, afterStatistics.compiler.totalMs);
	}
	return {
		endToEndMs: finished - started,
		compiler,
		viteAndBrowserMs:
			condition === "cli"
				? finished - compilerFinished
				: Math.max(0, finished - started - compiler.internalTotalMs),
		viteAndBrowserMethod:
			condition === "cli"
				? "measured after compiler process exit"
				: "end-to-end residual after compiler internal total",
		browserObservation:
			previousModuleText == null
				? `successful response for ${observedModule} plus exact runtime state`
				: `successful changed response for ${observedModule}; runtime behavior intentionally remains exact and unchanged`,
		hooks: hookMeasurement(beforeStatistics, afterStatistics),
		retained: await retainedProcesses(),
	};
}

async function measureProductionBuild(condition, fixture) {
	let compiler = null;
	let plugin;
	if (condition === "adapter") {
		const compilerStarted = performance.now();
		plugin = await typescriptProject({ configFile: fixture.configFile, cwd: fixture.root });
		compiler = adapterCompilerMeasurement(plugin.api.statistics.compiler, performance.now() - compilerStarted);
	}
	const beforeStatistics = plugin?.api.statistics ?? null;
	const started = performance.now();
	let result;
	try {
		result = await viteBuild({
			...viteConfiguration(fixture.root, plugin),
			build: { minify: true, write: false },
		});
	} finally {
		await plugin?.api.dispose();
	}
	const bundlingMs = performance.now() - started;
	const outputs = (Array.isArray(result) ? result : [result]).flatMap(({ output }) => output);
	const chunks = outputs.filter((output) => output.type === "chunk");
	assert.ok(chunks.length > 0, "Production build emitted no JavaScript chunks");
	assert.ok(
		chunks.some(({ code }) => code.includes("prepared asset")),
		"Production JavaScript omitted the generated asset",
	);
	assert.ok(
		chunks.some(({ code }) => code.includes("decorated")),
		"Production JavaScript omitted decorator behavior",
	);
	const initialChunks = initialLoadedChunks(chunks);
	const javascriptBytes = chunks.reduce((sum, { code }) => sum + Buffer.byteLength(code), 0);
	const initialJavascriptBytes = initialChunks.reduce((sum, { code }) => sum + Buffer.byteLength(code), 0);
	return {
		bundlingMs,
		compiler,
		javascriptBytes,
		chunkCount: chunks.length,
		initialLoadedChunkCount: initialChunks.length,
		initialLoadedJavascriptBytes: initialJavascriptBytes,
		chunks: chunks.map(({ code, dynamicImports, fileName, imports, isEntry }) => ({
			bytes: Buffer.byteLength(code),
			dynamicImports,
			fileName,
			hash: hash(code),
			imports,
			isEntry,
		})),
		hooks: hookMeasurement(beforeStatistics, plugin?.api.statistics ?? null),
	};
}

function viteConfiguration(root, plugin) {
	return {
		appType: "spa",
		configFile: false,
		logLevel: "silent",
		...(plugin ? { plugins: [plugin] } : {}),
		root,
		optimizeDeps: { exclude: ["@fixture/a", "@fixture/b", "@fixture/c"] },
		server: { forwardConsole: true, host: "127.0.0.1", port: 0, strictPort: false },
	};
}

async function runCompiler(cwd) {
	const args = [
		compilerFile,
		"--build",
		"tsconfig.json",
		"--builders",
		"4",
		"--checkers",
		"2",
		"--extendedDiagnostics",
	];
	const started = performance.now();
	const child = spawn(process.execPath, args, {
		cwd,
		env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let stdout = "";
	let stderr = "";
	child.stdout.setEncoding("utf8");
	child.stderr.setEncoding("utf8");
	child.stdout.on("data", (chunk) => (stdout += chunk));
	child.stderr.on("data", (chunk) => (stderr += chunk));
	const { code, signal } = await new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => resolve({ code, signal }));
	});
	const wallMs = performance.now() - started;
	assert.equal(code, 0, `TypeScript failed (${signal ?? code}):\n${stdout}${stderr}`);
	const reported = parseExtendedDiagnostics(`${stdout}\n${stderr}`);
	return {
		wallMs,
		configurationMs: diagnosticTime(reported, /config|parse/i),
		checkingMs: diagnosticTime(reported, /check/i),
		emitMs: diagnosticTime(reported, /emit/i),
		internalTotalMs: diagnosticTime(reported, /build time|total time/i),
		peakNativeCompilerRssBytes: null,
		peakNativeCompilerRssReason:
			"Native compiler peak RSS is sampled once per condition in memory.sampledProcessPeaks.",
		apiRequestCount: null,
		reported,
		rawOutput: { stdout, stderr },
		unavailablePhases: [
			...(diagnosticTime(reported, /config|parse/i) == null
				? ["configuration: the CLI did not report a separable configuration phase"]
				: []),
			...(diagnosticTime(reported, /check/i) == null
				? ["checking: the CLI did not report a separable checking phase"]
				: []),
			...(diagnosticTime(reported, /emit/i) == null
				? ["emit: the CLI did not report a separable emit phase"]
				: []),
		],
	};
}

function adapterCompilerMeasurement(timing, wallMs) {
	return {
		wallMs,
		configurationMs: timing.configurationMs,
		checkingMs: timing.diagnosticsMs,
		emitMs: timing.emitMs,
		internalTotalMs: timing.totalMs,
		peakNativeCompilerRssBytes: null,
		peakNativeCompilerRssReason:
			"The persistent compiler is sampled in retained process snapshots; stage-local peak RSS is unavailable.",
		apiRequestCount: timing.apiRequestCount,
		reported: timing.api,
	};
}

function parseExtendedDiagnostics(output) {
	const values = {};
	for (const line of output.split(/\r?\n/)) {
		const match = /^\s*([^:]+):\s*([\d.]+)\s*(ms|s)\s*$/.exec(line);
		if (match) {
			values[match[1].trim()] = Number(match[2]) * (match[3] === "s" ? 1_000 : 1);
		}
	}
	return values;
}

function diagnosticTime(values, pattern) {
	const matches = Object.entries(values).filter(([name]) => pattern.test(name));
	const match = matches.find(([name]) => name.startsWith("Aggregate ")) ?? matches[0];
	return match?.[1] ?? null;
}

function hookMeasurement(before, after) {
	if (!after) {
		return {
			refreshes: null,
			resolveCalls: null,
			loadCalls: null,
			reason: "The CLI disk path has no adapter hooks.",
		};
	}
	return {
		refreshes: after.refreshes - (before?.refreshes ?? 0),
		resolveCalls: after.resolveCalls - (before?.resolveCalls ?? 0),
		loadCalls: after.loadCalls - (before?.loadCalls ?? 0),
	};
}

async function waitForBrowserState(page, expected, minimumGeneration = 0) {
	try {
		await page.waitForFunction(
			({ expected, minimumGeneration }) => {
				const state = window.__typescriptAdapter;
				return (
					state &&
					state.generation >= minimumGeneration &&
					Object.entries(expected).every(([key, value]) => state[key] === value)
				);
			},
			{ expected, minimumGeneration },
			{ timeout: timeoutMs },
		);
	} catch (error) {
		const actual = await page.evaluate(() => ({
			overlay: document.querySelector("vite-error-overlay")?.shadowRoot?.textContent,
			state: window.__typescriptAdapter,
		}));
		throw new Error(`Browser did not observe ${JSON.stringify(expected)}; actual ${JSON.stringify(actual)}`, {
			cause: error,
		});
	}
}

async function browserResources(page) {
	return page.evaluate(() =>
		performance
			.getEntriesByType("resource")
			.map(({ name }) => new URL(name).pathname)
			.filter((name) => /\.(?:js|mjs)(?:$|\?)/.test(name))
			.sort(),
	);
}

async function updateCompilerTarget(root, project, target) {
	const file = path.join(root, project, "tsconfig.json");
	const config = JSON.parse(await readFile(file, "utf8"));
	config.compilerOptions.target = target;
	await writeFile(file, JSON.stringify(config));
}

async function assertStorageMode(condition, fixture) {
	if (condition === "adapter") {
		await fixture.assertNoDist();
		return;
	}
	for (const name of ["a", "b", "c"]) {
		assert.ok(existsSync(path.join(fixture.root, name, "dist")), `${name}/dist was not written by CLI baseline`);
	}
}

async function closeDevelopment(development) {
	if (!development) {
		return;
	}
	await development.page?.close();
	await development.server?.close();
	await development.plugin?.api.dispose();
}

function serverOrigin(server) {
	const address = server.httpServer.address();
	assert.ok(address && typeof address === "object", "Vite did not expose a loopback address");
	return `http://127.0.0.1:${address.port}`;
}

function initialLoadedChunks(chunks) {
	const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
	const loaded = new Set();
	const visit = (chunk) => {
		if (loaded.has(chunk.fileName)) {
			return;
		}
		loaded.add(chunk.fileName);
		for (const imported of chunk.imports) {
			const dependency = byName.get(imported);
			if (dependency) {
				visit(dependency);
			}
		}
	};
	for (const entry of chunks.filter(({ isEntry }) => isEntry)) {
		visit(entry);
	}
	assert.ok(loaded.size > 0, "Production build emitted no entry chunk");
	return [...loaded].map((file) => byName.get(file));
}

async function retainedProcesses() {
	const rows = await processTable();
	const children = new Map();
	for (const row of rows) {
		(children.get(row.ppid) ?? children.set(row.ppid, []).get(row.ppid)).push(row);
	}
	const descendants = [];
	const visit = (pid) => {
		for (const child of children.get(pid) ?? []) {
			descendants.push(child);
			visit(child.pid);
		}
	};
	visit(process.pid);
	const nativeCompiler = descendants.filter(({ command }) => isNativeCompiler(command));
	const compilerNodeWrappers = descendants.filter(({ command }) => {
		const [executable, ...arguments_] = command.split(" ");
		return (
			path.basename(executable).startsWith("node") &&
			arguments_.some((argument) => /typescript\/bin\/tsc$/.test(argument))
		);
	});
	const browsers = descendants.filter(({ command }) => /(?:chromium|chrome)/i.test(command));
	return {
		totalDescendantCount: descendants.length,
		compiler: {
			kind: "native compiler executable",
			count: nativeCompiler.length,
			rssBytes: nativeCompiler.reduce((sum, { rssBytes }) => sum + rssBytes, 0),
			processes: nativeCompiler.map(({ command, pid, rssBytes }) => ({
				command: path.basename(command.split(" ", 1)[0]),
				pid,
				rssBytes,
			})),
		},
		compilerNodeWrapper: {
			kind: "Node CLI launcher before execve",
			count: compilerNodeWrappers.length,
			rssBytes: compilerNodeWrappers.reduce((sum, { rssBytes }) => sum + rssBytes, 0),
		},
		browser: { count: browsers.length, rssBytes: browsers.reduce((sum, { rssBytes }) => sum + rssBytes, 0) },
	};
}

function isNativeCompiler(command) {
	const executable = path.basename(command.split(" ", 1)[0]);
	return executable === "tsc" || executable === "tsserver" || executable === "tsgo" || executable === "_tsc";
}

function startProcessSampler() {
	const peaks = {
		browserRssBytes: 0,
		compilerProcessCount: 0,
		compilerNodeWrapperCount: 0,
		compilerNodeWrapperRssBytes: 0,
		nativeCompilerRssBytes: 0,
		intervalMs: 50,
		limitation: "Polling may miss a shorter-lived RSS peak between samples.",
	};
	let active = false;
	let stopped = false;
	let samplerError;
	let pending = Promise.resolve();
	const sample = () => {
		if (active || stopped) {
			return;
		}
		active = true;
		pending = retainedProcesses()
			.then(({ browser, compiler, compilerNodeWrapper }) => {
				peaks.browserRssBytes = Math.max(peaks.browserRssBytes, browser.rssBytes);
				peaks.compilerProcessCount = Math.max(peaks.compilerProcessCount, compiler.count);
				peaks.compilerNodeWrapperCount = Math.max(peaks.compilerNodeWrapperCount, compilerNodeWrapper.count);
				peaks.compilerNodeWrapperRssBytes = Math.max(
					peaks.compilerNodeWrapperRssBytes,
					compilerNodeWrapper.rssBytes,
				);
				peaks.nativeCompilerRssBytes = Math.max(peaks.nativeCompilerRssBytes, compiler.rssBytes);
			})
			.catch((error) => {
				samplerError ??= error;
			})
			.finally(() => {
				active = false;
			});
	};
	const timer = setInterval(sample, peaks.intervalMs);
	sample();
	return {
		async stop() {
			if (stopped) {
				return peaks;
			}
			stopped = true;
			clearInterval(timer);
			await pending;
			if (samplerError) {
				throw new Error("Native compiler RSS sampler failed", { cause: samplerError });
			}
			return peaks;
		},
	};
}

async function processTable() {
	const { stdout } = await capture("ps", ["-axo", "pid=,ppid=,rss=,command="]);
	return stdout
		.split(/\r?\n/)
		.map((line) => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line))
		.filter(Boolean)
		.map((match) => ({
			pid: Number(match[1]),
			ppid: Number(match[2]),
			rssBytes: Number(match[3]) * 1024,
			command: match[4],
		}))
		.filter(({ command }) => !/(?:^|\/)ps -axo pid=,ppid=,rss=,command=$/.test(command));
}

async function runWorker(condition, sample) {
	const { stdout, stderr } = await capture(
		process.execPath,
		[scriptFile, "--worker", condition, "--sample", String(sample)],
		{
			cwd: repositoryRoot,
			maxBuffer: 64 * 1024 * 1024,
		},
	);
	const line = stdout.split(/\r?\n/).findLast((candidate) => candidate.startsWith(resultMarker));
	if (!line) {
		throw new Error(`Worker ${condition} ${sample} returned no result:\n${stdout}\n${stderr}`);
	}
	return {
		...JSON.parse(line.slice(resultMarker.length)),
		workerOutput: { stderr, stdoutBeforeResult: stdout.slice(0, stdout.lastIndexOf(line)) },
	};
}

function assertPairParity(samples) {
	const cli = samples.cli;
	const adapter = samples.adapter;
	assert.equal(
		cli.fixture.initial.hash,
		adapter.fixture.initial.hash,
		"Paired workers did not start from identical fixture input",
	);
	assert.equal(
		cli.fixture.final.hash,
		adapter.fixture.final.hash,
		"Paired workers did not finish with identical fixture input",
	);
	const cliProduction = cli.workloads.production;
	const adapterProduction = adapter.workloads.production;
	assert.equal(
		cliProduction.javascriptBytes,
		adapterProduction.javascriptBytes,
		"Production JavaScript bytes differ",
	);
	assert.equal(cliProduction.chunkCount, adapterProduction.chunkCount, "Production chunk counts differ");
	assert.equal(
		cliProduction.initialLoadedChunkCount,
		adapterProduction.initialLoadedChunkCount,
		"Initial loaded production chunk counts differ",
	);
	assert.deepEqual(
		cliProduction.chunks.map(({ hash: value }) => value).sort(),
		adapterProduction.chunks.map(({ hash: value }) => value).sort(),
		"Production JavaScript content differs",
	);
	return {
		identicalInputHashes: true,
		identicalProductionJavaScript: true,
		productionJavaScriptBytes: cliProduction.javascriptBytes,
		initialLoadedChunkCount: cliProduction.initialLoadedChunkCount,
	};
}

function summarize(pairs) {
	const metrics = {
		coldStartupEndToEndMs: ["workloads", "coldStartup", "endToEndMs"],
		noChangeStartupEndToEndMs: ["workloads", "noChangeStartup", "endToEndMs"],
		directEditBrowserObservedMs: ["workloads", "directEdit", "endToEndMs"],
		transitiveEditBrowserObservedMs: ["workloads", "transitiveEdit", "endToEndMs"],
		configEditBrowserObservedMs: ["workloads", "configEdit", "endToEndMs"],
		productionBundlingMs: ["workloads", "production", "bundlingMs"],
		nodeHostPeakRssBytes: ["memory", "nodeHostPeakRssBytes"],
		nativeCompilerPeakRssBytes: ["memory", "sampledProcessPeaks", "nativeCompilerRssBytes"],
	};
	return {
		interpretation:
			"For latency and memory, paired ratios are CLI divided by adapter, so values above 1 favor the adapter.",
		metrics: Object.fromEntries(
			Object.entries(metrics).map(([name, keyPath]) => {
				const values = pairs.map(({ samples }) => ({
					adapter: valueAt(samples.adapter, keyPath),
					cli: valueAt(samples.cli, keyPath),
				}));
				return [name, distribution(values)];
			}),
		),
		productionArtifacts: {
			javascriptBytes: pairs.map(({ samples }) => samples.cli.workloads.production.javascriptBytes),
			initialLoadedChunkCount: pairs.map(
				({ samples }) => samples.cli.workloads.production.initialLoadedChunkCount,
			),
			parityAssertedForEveryPair: true,
		},
	};
}

function distribution(pairs) {
	if (pairs.some(({ adapter, cli }) => !(adapter > 0) || !(cli > 0))) {
		return {
			status: "unavailable",
			reason: "At least one paired value was absent or zero; no value was imputed.",
			pairs,
		};
	}
	const cli = pairs.map(({ cli: value }) => value);
	const adapter = pairs.map(({ adapter: value }) => value);
	const logs = pairs.map(({ adapter: candidate, cli: baseline }) => Math.log(baseline / candidate));
	const meanLog = mean(logs);
	const standardDeviation = Math.sqrt(
		logs.reduce((sum, value) => sum + (value - meanLog) ** 2, 0) / (logs.length - 1),
	);
	const margin = tCritical95(logs.length - 1) * (standardDeviation / Math.sqrt(logs.length));
	return {
		status: "measured",
		pairs,
		cli: spread(cli),
		adapter: spread(adapter),
		pairedCliOverAdapterRatio: {
			geometricMean: Math.exp(meanLog),
			lower95: Math.exp(meanLog - margin),
			upper95: Math.exp(meanLog + margin),
		},
	};
}

function spread(values) {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return {
		values,
		minimum: sorted[0],
		median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
		maximum: sorted.at(-1),
		mean: mean(sorted),
	};
}

function mean(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function valueAt(value, keys) {
	for (const key of keys) {
		value = value?.[key];
	}
	return value ?? null;
}

function tCritical95(degreesOfFreedom) {
	const values = [
		12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12,
		2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
	];
	return values[degreesOfFreedom - 1] ?? 1.96;
}

function capture(command, args, { cwd = repositoryRoot, maxBuffer = 16 * 1024 * 1024 } = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
			if (stdout.length > maxBuffer) {
				child.kill();
			}
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
			if (stderr.length > maxBuffer) {
				child.kill();
			}
		});
		child.once("error", reject);
		child.once("close", (code, signal) => {
			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				reject(new Error(`${command} exited with ${signal ?? code}:\n${stdout}${stderr}`));
			}
		});
	});
}

async function environmentRecord() {
	const [npm, revision, status, typescript, vite, playwright] = await Promise.all([
		capture("npm", ["--version"]),
		capture("git", ["rev-parse", "HEAD"]),
		capture("git", ["status", "--short"]),
		packageVersion("typescript"),
		packageVersion("vite"),
		packageVersion("playwright"),
	]);
	return {
		platform: process.platform,
		architecture: process.arch,
		osRelease: os.release(),
		cpuModel: os.cpus()[0]?.model ?? null,
		logicalCpuCount: os.cpus().length,
		totalMemoryBytes: os.totalmem(),
		node: process.version,
		npm: npm.stdout.trim(),
		typescript: typescript.version,
		vite: vite.version,
		playwright: playwright.version,
		revision: revision.stdout.trim(),
		dirtyState: status.stdout,
	};
}

async function packageVersion(name) {
	const manifest = JSON.parse(
		await readFile(path.join(repositoryRoot, "node_modules", name, "package.json"), "utf8"),
	);
	return { name, version: manifest.version };
}

async function sourceHashes() {
	const files = [
		"package.json",
		"package-lock.json",
		"TYPESCRIPT-7.1-MIGRATION.md",
		"scripts/typescript-adapter/benchmark.mjs",
		"scripts/typescript-adapter/browser-fixture.mjs",
		"scripts/typescript-adapter/plugin.mjs",
		"scripts/typescript-adapter/session.mjs",
	];
	return Object.fromEntries(
		await Promise.all(files.map(async (file) => [file, hash(await readFile(path.join(repositoryRoot, file)))])),
	);
}

async function hashFixture(root) {
	const files = [];
	const visit = async (directory) => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (entry.name === "node_modules" || entry.name === "dist" || entry.name.endsWith(".tsbuildinfo")) {
				continue;
			}
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				await visit(absolute);
			} else if (entry.isFile()) {
				files.push({ file: path.relative(root, absolute), hash: hash(await readFile(absolute)) });
			}
		}
	};
	await visit(root);
	files.sort((left, right) => left.file.localeCompare(right.file));
	return { hash: hash(JSON.stringify(files)), files };
}

function hash(value) {
	return createHash("sha256").update(value).digest("hex");
}

async function persist(file, value) {
	await mkdir(path.dirname(file), { recursive: true });
	const temporary = `${file}.${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
	await rename(temporary, file);
}

function parseArguments(args) {
	const options = { runs: 5, sample: 0 };
	for (let index = 0; index < args.length; ++index) {
		const argument = args[index];
		if (argument === "--help" || argument === "-h") {
			options.help = true;
		} else if (argument === "--run") {
			options.run = true;
		} else if (argument === "--smoke") {
			options.smoke = true;
		} else if (argument === "--runs") {
			options.runs = Number(args[++index]);
		} else if (argument === "--output") {
			options.output = args[++index];
		} else if (argument === "--worker") {
			options.worker = args[++index];
		} else if (argument === "--sample") {
			options.sample = Number(args[++index]);
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (!Number.isSafeInteger(options.runs) || options.runs < 1) {
		throw new Error("--runs must be a positive integer");
	}
	return options;
}

function defaultOutputFile() {
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	return path.join(os.tmpdir(), "typescript-adapter-20260904", "evidence", `benchmark-${stamp}.json`);
}

function usage() {
	return [
		"Usage:",
		"  node scripts/typescript-adapter/benchmark.mjs --smoke",
		"  node scripts/typescript-adapter/benchmark.mjs --run [--runs 5] [--output /absolute/result.json]",
		"",
		"--run is an intentional guard for the measured suite. Five paired runs is the minimum.",
	].join("\n");
}

function isEntrypoint() {
	return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}
