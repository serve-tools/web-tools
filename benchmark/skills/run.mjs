#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDiscoveryContext, loadCatalog, loadDocuments, normalizeRoute } from "./lib/catalog.mjs";
import { gradeResult } from "./lib/grader.mjs";
import { emptyMetrics, FixtureProvider, OpenAIProvider } from "./lib/providers.mjs";
import { createReport, renderMarkdown } from "./lib/report.mjs";
import { tasks } from "./tasks.mjs";

const benchmarkRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(path.dirname(benchmarkRoot));
const options = parseArguments(process.argv.slice(2));
const selectedTasks = tasks.filter(
	(task) =>
		(options.kinds.size === 0 || options.kinds.has(task.kind)) &&
		(options.taskIDs.size === 0 || options.taskIDs.has(task.id)),
);

if (options.help) {
	printHelp();
	process.exit(0);
}

if (selectedTasks.length === 0) {
	throw new Error("No benchmark tasks match the selected filters");
}

const catalog = await loadCatalog(root);
const provider =
	options.provider === "fixture"
		? new FixtureProvider(root)
		: new OpenAIProvider({
				apiKey: process.env.OPENAI_API_KEY,
				model: options.model,
				reasoningEffort: options.reasoningEffort,
			});
const discoveryContexts = new Map();

for (const variant of options.variants) {
	for (const kind of new Set(selectedTasks.map((task) => task.kind))) {
		discoveryContexts.set(`${variant}\0${kind}`, await createDiscoveryContext(catalog, variant, kind));
	}
}

const jobs = [];

for (let run = 1; run <= options.runs; ++run) {
	for (const task of selectedTasks) {
		for (const variant of options.variants) {
			jobs.push({ run, task, variant });
		}
	}
}

shuffle(jobs, options.seed);

const records = [];

for (const [index, job] of jobs.entries()) {
	const label = `${index + 1}/${jobs.length} ${job.task.id} ${job.variant} run ${job.run}`;
	if (!options.quiet) {
		process.stderr.write(`${label}\n`);
	}

	try {
		records.push(await evaluate(job));
	} catch (error) {
		records.push({
			error: error instanceof Error ? error.message : String(error),
			grade: { checks: {}, pass: false, score: 0 },
			kind: job.task.kind,
			metrics: emptyMetrics(),
			run: job.run,
			taskId: job.task.id,
			variant: job.variant,
		});
	}
}

records.sort(
	(left, right) =>
		left.taskId.localeCompare(right.taskId) || left.run - right.run || left.variant.localeCompare(right.variant),
);

const report = createReport(records, {
	compile: options.compile,
	kinds: [...options.kinds],
	model: options.model,
	provider: options.provider,
	reasoningEffort: options.reasoningEffort,
	runs: options.runs,
	seed: options.seed,
	taskIDs: [...options.taskIDs],
	variants: options.variants,
});
const markdown = renderMarkdown(report);

process.stdout.write(markdown);

if (options.output !== undefined) {
	const outputBase = path.resolve(options.output).replace(/\.(?:json|md)$/i, "");
	await mkdir(path.dirname(outputBase), { recursive: true });
	await writeFile(`${outputBase}.json`, `${JSON.stringify(report, undefined, "\t")}\n`);
	await writeFile(`${outputBase}.md`, markdown);
}

if (records.some((record) => !record.grade.pass)) {
	process.exitCode = 1;
}

async function evaluate({ run, task, variant }) {
	const discoveryContext = discoveryContexts.get(`${variant}\0${task.kind}`);
	const routeResult = await provider.route({ catalog, discoveryContext, task, variant });
	const route = normalizeRoute(catalog, routeResult.data, variant);
	let documents = "";
	let documentMetrics = emptyMetrics();
	let routerCharacters = 0;
	let solution = { answer: "", files: [] };
	let solutionMetrics = emptyMetrics();

	if (task.kind !== "selection") {
		if (variant === "skill") {
			const routers = await loadDocuments(catalog, route.documents);
			const documentResult = await provider.selectDocuments({ catalog, route, routers, task });
			const refinedRoute = normalizeRoute(
				catalog,
				{
					documents: documentResult.data.documents,
					packages: route.packages,
					rationale: documentResult.data.rationale,
				},
				variant,
			);
			route.documents = refinedRoute.documents;
			documentMetrics = documentResult.metrics;
			routerCharacters = routers.length;
		}

		documents = await loadDocuments(catalog, route.documents);
		const solutionResult = await provider.solve({ documents, route, task, variant });
		solution = solutionResult.data;
		solutionMetrics = solutionResult.metrics;
	}

	const grade = await gradeResult({ catalog, compile: options.compile, route, solution, task, variant });
	const metrics = combineMetrics(routeResult.metrics, documentMetrics, solutionMetrics);
	metrics.contextCharacters = discoveryContext.length + routerCharacters + documents.length;

	return {
		grade,
		kind: task.kind,
		metrics,
		route,
		run,
		solution,
		taskId: task.id,
		variant,
	};
}

function parseArguments(arguments_) {
	const values = {
		compile: undefined,
		help: false,
		kinds: new Set(),
		model: undefined,
		output: undefined,
		provider: "fixture",
		quiet: false,
		reasoningEffort: "low",
		runs: 1,
		seed: 20_260_814,
		taskIDs: new Set(),
		variants: ["baseline", "skill"],
	};

	for (let index = 0; index < arguments_.length; ++index) {
		const argument = arguments_[index];
		const next = () => {
			const value = arguments_[++index];
			if (value === undefined) {
				throw new Error(`${argument} requires a value`);
			}
			return value;
		};

		switch (argument) {
			case "--compile":
				values.compile = true;
				break;
			case "--help":
			case "-h":
				values.help = true;
				break;
			case "--kind":
				values.kinds.add(next());
				break;
			case "--model":
				values.model = next();
				break;
			case "--no-compile":
				values.compile = false;
				break;
			case "--output":
				values.output = next();
				break;
			case "--provider":
				values.provider = next();
				break;
			case "--quiet":
				values.quiet = true;
				break;
			case "--reasoning":
				values.reasoningEffort = next();
				break;
			case "--runs":
				values.runs = Number.parseInt(next(), 10);
				break;
			case "--seed":
				values.seed = Number.parseInt(next(), 10);
				break;
			case "--task":
				values.taskIDs.add(next());
				break;
			case "--variants":
				values.variants = next().split(",");
				break;
			default:
				throw new Error(`Unknown option: ${argument}`);
		}
	}

	if (!Number.isInteger(values.runs) || values.runs < 1) {
		throw new Error("--runs must be a positive integer");
	}
	if (!Number.isInteger(values.seed)) {
		throw new Error("--seed must be an integer");
	}
	if (!new Set(["fixture", "openai"]).has(values.provider)) {
		throw new Error("--provider must be fixture or openai");
	}
	if (values.variants.some((variant) => variant !== "baseline" && variant !== "skill")) {
		throw new Error("--variants must contain only baseline and skill");
	}

	values.compile ??= values.provider !== "fixture";

	return values;
}

function combineMetrics(...metrics) {
	const combined = emptyMetrics();

	for (const metric of metrics) {
		for (const key of Object.keys(combined)) {
			combined[key] += metric[key] ?? 0;
		}
	}

	return combined;
}

function shuffle(values, seed) {
	const random = mulberry32(seed);

	for (let index = values.length - 1; index > 0; --index) {
		const target = Math.floor(random() * (index + 1));
		[values[index], values[target]] = [values[target], values[index]];
	}
}

function mulberry32(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function printHelp() {
	console.log(`Usage: node benchmark/skills/run.mjs [options]

Options:
  --provider fixture|openai  Use deterministic fixtures or the OpenAI Responses API
  --model MODEL             Required for the OpenAI provider
  --reasoning EFFORT        Reasoning effort for live runs (default: low)
  --runs COUNT              Repetitions per task and variant (default: 1)
  --variants LIST           Comma-separated baseline and/or skill (default: both)
  --kind KIND               Filter by selection, composition, or usage; repeatable
  --task ID                 Filter by task identifier; repeatable
  --compile / --no-compile  Override generated TypeScript compilation
  --seed INTEGER            Randomized paired execution order seed
  --output PATH             Write PATH.json and PATH.md
  --quiet                   Suppress per-job progress
  --help                    Show this help
`);
}
