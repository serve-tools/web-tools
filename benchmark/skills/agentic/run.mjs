import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConditions } from "./conditions.mjs";
import { freezeTask, gradeArtifact, runProcess } from "./grading.mjs";
import { CodexProvider } from "./provider.mjs";
import { renderReport, summarize } from "./report.mjs";
import { cleanupRuntime, prepareRuntime } from "./runtime.mjs";
import { filesUnder, runtimeFingerprint } from "./snapshot.mjs";
import { tasks } from "./tasks.mjs";
import { createToolSession, toolSpecs } from "./tools.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../..");

export function createJobs(selectedTasks, { seeds, runs, variants }) {
	const jobs = [];
	for (const seed of seeds) {
		const group = [];
		for (let run = 0; run < runs; ++run) {
			for (const task of selectedTasks) {
				for (const variant of variants) {
					group.push({ taskId: task.id, seed, run, variant });
				}
			}
		}
		let state = seed >>> 0;
		for (let index = group.length - 1; index > 0; --index) {
			state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
			const other = state % (index + 1);
			[group[index], group[other]] = [group[other], group[index]];
		}
		jobs.push(...group);
	}
	return jobs;
}

/** Keep the three treatments adjacent within each randomized task/repetition block. */
export function createBlockedJobs(selectedTasks, { seeds, runs, variants }) {
	const jobs = [];
	for (const seed of seeds) {
		let state = seed >>> 0;
		const random = () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let value = Math.imul(state ^ (state >>> 15), state | 1);
			value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
			return (value ^ (value >>> 14)) >>> 0;
		};
		const shuffle = (values) => {
			for (let index = values.length - 1; index > 0; --index) {
				const other = random() % (index + 1);
				[values[index], values[other]] = [values[other], values[index]];
			}
			return values;
		};
		const blocks = selectedTasks.flatMap((task) =>
			Array.from({ length: runs }, (_, run) => ({ taskId: task.id, run, seed })),
		);
		const permutations = (values) =>
			values.length
				? values.flatMap((value, index) =>
						permutations(values.filter((_, position) => position !== index)).map((rest) => [
							value,
							...rest,
						]),
					)
				: [[]];
		let orders = [];
		for (const block of shuffle(blocks)) {
			if (!orders.length) {
				orders = shuffle(permutations(variants));
			}
			jobs.push(...orders.pop().map((variant) => ({ ...block, variant })));
		}
	}
	return jobs;
}

export async function evaluateJob({ provider, job, condition, task, output, timeoutMs, maxActions, maxChecks }) {
	const started = performance.now();
	const startedAt = new Date().toISOString();
	const hostLoadStart = os.loadavg();
	const events = [];
	let firstWriteMs = null;
	let firstCopyMs = null;
	let firstAuthoredWriteMs = null;
	let firstFailedCheckMs = null;
	const session = createToolSession({
		condition,
		maxActions,
		maxChecks,
		check: (source) => gradeArtifact({ root, task, source }),
	});
	let response;
	let error;
	try {
		response = await provider.run({
			prompt: createPrompt(task, condition, maxActions, maxChecks),
			tools: toolSpecs,
			onTool: async (name, args) => {
				const result = await session.call(name, args);
				if (name === "copy_file" && !result.error && firstCopyMs === null) {
					firstCopyMs = performance.now() - started;
				}
				if (
					["write_solution", "replace_solution"].includes(name) &&
					!result.error &&
					firstAuthoredWriteMs === null
				) {
					firstAuthoredWriteMs = performance.now() - started;
				}
				if (
					["write_solution", "copy_file", "replace_solution"].includes(name) &&
					!result.error &&
					firstWriteMs === null
				) {
					firstWriteMs = performance.now() - started;
				}
				if (name === "check" && (!result.compile || !result.smoke) && firstFailedCheckMs === null) {
					firstFailedCheckMs = performance.now() - started;
				}
				return result;
			},
			onEvent: (event) => events.push(event),
			timeoutMs,
		});
	} catch (caught) {
		error = caught.message;
		response = caught.result ?? {
			status: caught.status ?? "provider_error",
			usage: caught.usage ?? null,
			usageComplete: caught.usageComplete ?? false,
			measurementError: caught.measurementError ?? "Interrupted provider work may have unreported token usage.",
			model: caught.model,
			threadId: caught.threadId,
		};
	}
	const agentElapsedMs = performance.now() - started;
	let grade;
	try {
		grade = await gradeArtifact({ root, task, source: session.source, hidden: true });
	} catch (caught) {
		grade = { compile: false, smoke: false, hidden: false, feedback: caught.message, infrastructureError: true };
	}
	const record = {
		...job,
		startedAt,
		finishedAt: new Date().toISOString(),
		conditionHash: condition.sha256,
		status: response.status,
		backendStatus: response.backendStatus ?? null,
		usageEvidence: response.usageEvidence ?? null,
		accountingDrainMs: response.accountingDrainMs ?? null,
		error: error ?? response.error ?? null,
		// A timed-out or incomplete episode is unsuccessful even if its last artifact happened to pass.
		pass:
			response.status === "completed" &&
			grade.compile &&
			grade.contracts !== false &&
			grade.smoke &&
			grade.hidden,
		artifactPass: grade.compile && grade.contracts !== false && grade.smoke && grade.hidden,
		grade,
		usage: response.usage ?? null,
		usageComplete: response.usageComplete ?? response.usage != null,
		measurementError: response.measurementError ?? null,
		commonContext: response.commonContext ?? null,
		model: response.model,
		threadId: response.threadId,
		elapsedMs: performance.now() - started,
		agentElapsedMs,
		discoveryToFirstWriteMs: firstWriteMs,
		firstCopyMs,
		firstAuthoredWriteMs,
		repairAfterFirstFailureMs: firstFailedCheckMs === null ? 0 : agentElapsedMs - firstFailedCheckMs,
		actions: session.actions,
		copies: session.trace.filter((entry) => entry.name === "copy_file" && !entry.result.error).length,
		checkResults: session.checkResults,
		documents: session.documents,
		finalText: response.finalText,
		hostLoadStart,
		hostLoadEnd: os.loadavg(),
	};
	const id = `${job.seed}-${job.run}-${job.taskId}-${job.variant}`;
	await mkdir(path.join(output, "attempts", id), { recursive: true });
	await writeFile(path.join(output, "attempts", id, "solution.ts"), session.source);
	await writeFile(
		path.join(output, "attempts", id, "trace.json"),
		JSON.stringify({ record, tools: session.trace, events }, null, 2),
	);
	await appendFile(path.join(output, "records.jsonl"), `${JSON.stringify(record)}\n`);
	return record;
}

export function createPrompt(task, condition, maxActions, maxChecks) {
	return [
		"Implement the following unfamiliar consumer task using the installed public packages. Work only through the supplied virtual tools.",
		"Discover documentation yourself. No package or recipe is selected for you. Read only what helps, and use native APIs where appropriate.",
		"Produce solution.ts with the requested exported API. Only solution.ts is delivered; do not create configuration files or depend on other local modules.",
		"Use check for TypeScript and public behavioral feedback, and repair errors before finishing. Additional withheld behavioral cases evaluate the same stated requirements after you finish.",
		`You have at most ${maxActions} tool actions and ${maxChecks} public check attempts. Finish with a brief final response when the artifact is ready.`,
		"Host shell, network, other agents, personal memories, and unrelated skills are unavailable. Do not attempt to access them.",
		"",
		"TASK",
		task.prompt,
		"",
		"AVAILABLE MATERIAL",
		condition.discovery,
	].join("\n");
}

async function main() {
	const setupStarted = performance.now();
	const setupStartedAt = new Date().toISOString();
	const options = parseOptions(process.argv.slice(2));
	if (options.help) {
		process.stdout.write(
			"Usage: node benchmark/skills/agentic/run.mjs --output DIR [--model gpt-5.6-luna] [--effort low] [--runs 5] [--seeds 1709,4201] [--concurrency 4] [--timeout-ms 240000] [--task ID] [--variants docs,current,minimal]\nUse --fixture to validate all golden artifacts without a model. Live output directories must be new.\n",
		);
		return;
	}
	const catalog = options.suite === "original" ? tasks : (await import(`./${options.suite}/tasks.mjs`)).tasks;
	const reporting =
		options.suite === "ablation" ? await import("./ablation/report.mjs") : { summarize, renderReport };
	let selectedTasks = options.taskIds.length ? catalog.filter((task) => options.taskIds.includes(task.id)) : catalog;
	if (!selectedTasks.length || options.taskIds.some((id) => !catalog.some((task) => task.id === id))) {
		throw new Error("Unknown task selection.");
	}
	if (options.fixture) {
		let failed = false;
		for (const task of selectedTasks) {
			const source = await readFile(path.resolve(directory, task.fixturePath), "utf8");
			const grade = await gradeArtifact({ root, task, source, hidden: true });
			const pass = grade.compile && grade.contracts !== false && grade.smoke && grade.hidden;
			process.stdout.write(`${task.id}: ${pass ? "PASS" : JSON.stringify(grade)}\n`);
			failed ||= !pass;
		}
		if (failed) {
			process.exitCode = 1;
		}
		return;
	}
	if (!options.output) {
		throw new Error("Live evaluations require a durable --output directory.");
	}
	const output = path.resolve(options.output);
	if (output === directory || output.startsWith(`${directory}${path.sep}`)) {
		throw new Error("Keep live evidence outside the harness directory to avoid recursive snapshots.");
	}
	const conditions =
		options.suite === "ablation"
			? await (await import("./ablation/conditions.mjs")).createAblationConditions(root)
			: options.suite === "transfer"
				? await (await import("./transfer/conditions.mjs")).createTransferConditions(root)
				: await createConditions(root);
	selectedTasks = await Promise.all(selectedTasks.map(freezeTask));
	const preflight =
		options.suite !== "original"
			? await (await import(`./${options.suite}/preflight.mjs`)).verifyPreflight({
					conditions,
					tasks: selectedTasks,
					options,
				})
			: null;
	await mkdir(path.dirname(output), { recursive: true });
	await mkdir(output);
	await writeFile(path.join(output, "records.jsonl"), "", { flag: "wx" });
	const runtime = await prepareRuntime(root);
	const archived = await runProcess(
		"tar",
		["-czf", path.join(output, "runtime.tar.gz"), "-C", runtime.directory, "."],
		{ timeoutMs: 60_000 },
	);
	if (archived.code !== 0) {
		throw new Error(`Cannot preserve the frozen runtime: ${archived.output}`);
	}
	const jobs =
		options.suite !== "original" ? createBlockedJobs(selectedTasks, options) : createJobs(selectedTasks, options);
	const [revision, dirty, cli] = await Promise.all([
		runProcess("git", ["rev-parse", "HEAD"], { cwd: root }),
		runProcess("git", ["status", "--short"], { cwd: root }),
		runProcess("codex", ["--version"], { cwd: root }),
	]);
	const metadata = {
		setupStartedAt,
		startedAt: new Date().toISOString(),
		provider: "codex-app-server",
		providerVersion: cli.code === 0 ? cli.output.trim() : "unavailable",
		preflight,
		...options,
		revision: revision.output.trim(),
		dirty: dirty.output.trim(),
		node: process.version,
		platform: `${os.platform()} ${os.release()} ${os.arch()}`,
		cpu: os.cpus()[0]?.model,
		conditionHashes: Object.fromEntries(
			Object.entries(conditions).map(([id, condition]) => [id, condition.sha256]),
		),
		taskHashes: Object.fromEntries(
			await Promise.all(selectedTasks.map(async (task) => [task.id, await taskHash(task)])),
		),
		plannedAttempts: jobs.length,
		protocol:
			options.suite !== "original"
				? await readFile(path.join(directory, options.suite, "PROTOCOL.md"), "utf8")
				: null,
		taskFamilies: Object.fromEntries(selectedTasks.map((task) => [task.id, task.family ?? task.id])),
		runtimeHash: await runtimeFingerprint(root),
		runtimeArchiveHash: createHash("sha256")
			.update(await readFile(path.join(output, "runtime.tar.gz")))
			.digest("hex"),
		excludedPackages: conditions.docs.excludedPackages ?? [],
		measurement:
			"Fresh ephemeral consumer agent through final hidden validation, including discovery, generation, public checks, repair, and failures. Initial dependency build and shared provider startup excluded.",
	};
	await writeFile(path.join(output, "conditions.json"), JSON.stringify(conditions));
	for (const file of await filesUnder(directory)) {
		const target = path.join(output, "harness", path.relative(directory, file));
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, await readFile(file));
	}
	for (const relative of [
		"benchmark/skills/lib/report.mjs",
		"scripts/workspaces.mjs",
		"package.json",
		"package-lock.json",
	]) {
		const target = path.join(output, "support", relative);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, await readFile(path.join(root, relative)));
	}
	await writeFile(path.join(output, "plan.json"), JSON.stringify({ metadata, tasks: selectedTasks, jobs }, null, 2));
	const records = [];
	let cursor = 0;
	let progressWrite = Promise.resolve();
	let stopReason = null;
	const workerErrors = [];
	const providerStartupMs = [];
	metadata.sharedSetupMs = performance.now() - setupStarted;
	async function worker(workerId) {
		const provider = new CodexProvider({
			model: options.model,
			effort: options.effort,
			maxToolCalls: options.maxActions,
			...(options.suite === "ablation" ? { toolGraceMs: 10_000, accountingDrainMs: 100 } : {}),
		});
		let consecutiveInfrastructureFailures = 0;
		try {
			const startupStarted = performance.now();
			await provider.start();
			providerStartupMs.push({ workerId, elapsedMs: performance.now() - startupStarted });
			while (cursor < jobs.length && stopReason === null) {
				const allocationIndex = cursor;
				const job = { ...jobs[cursor++], allocationIndex, workerId, dispatchedAt: new Date().toISOString() };
				const task = selectedTasks.find((candidate) => candidate.id === job.taskId);
				const record = await evaluateJob({
					...options,
					provider,
					job,
					condition: conditions[job.variant],
					task,
					output,
				});
				records.push(record);
				consecutiveInfrastructureFailures =
					record.usage === null && record.actions === 0 ? consecutiveInfrastructureFailures + 1 : 0;
				if (consecutiveInfrastructureFailures >= 3) {
					stopReason =
						"Three consecutive attempts could not start measurable model work; remaining jobs were not attempted.";
				}
				process.stdout.write(
					`${records.length}/${jobs.length} ${job.taskId} ${job.variant} ${record.pass ? "PASS" : "FAIL"} ${(record.elapsedMs / 1000).toFixed(1)}s ${record.usage?.totalTokens ?? "unknown"} tokens ${record.status}\n`,
				);
				const progress = JSON.stringify(reporting.summarize(records, metadata), null, 2);
				progressWrite = progressWrite.then(() => writeFile(path.join(output, "progress.json"), progress));
				await progressWrite;
			}
		} catch (error) {
			workerErrors.push(error.message);
			stopReason ??= `Worker infrastructure error: ${error.message}`;
		} finally {
			try {
				await provider.close();
			} catch (error) {
				workerErrors.push(error.message);
				stopReason ??= `Worker shutdown error: ${error.message}`;
			}
		}
	}
	await Promise.all(Array.from({ length: options.concurrency }, (_, index) => worker(index)));
	metadata.finishedAt = new Date().toISOString();
	metadata.stopReason = stopReason;
	metadata.workerErrors = workerErrors;
	metadata.providerStartupMs = providerStartupMs;
	metadata.totalWallMs = performance.now() - setupStarted;
	metadata.assignedAttempts = cursor;
	metadata.completedPlan = records.length === jobs.length;
	metadata.materialsFrozen = true;
	try {
		metadata.hostRuntimeUnchanged = (await runtimeFingerprint(root)) === metadata.runtimeHash;
	} catch (error) {
		metadata.hostRuntimeUnchanged = null;
		metadata.hostDriftCheckError = error.message;
	}
	const report = reporting.summarize(records, metadata);
	await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
	await writeFile(path.join(output, "report.md"), reporting.renderReport(report));
	process.stdout.write(reporting.renderReport(report));
	if (!metadata.completedPlan) {
		process.exitCode = 1;
	}
}

async function taskHash(task) {
	const hash = createHash("sha256").update(JSON.stringify(task));
	for (const relative of task.programs ? [] : [task.smokePath, task.hiddenPath]) {
		hash.update(await readFile(path.resolve(directory, relative)));
	}
	return hash.digest("hex");
}

function parseOptions(args) {
	const options = {
		model: "gpt-5.6-luna",
		suite: "original",
		effort: "low",
		runs: 5,
		seeds: [1709, 4201],
		concurrency: 4,
		timeoutMs: 240_000,
		maxActions: 32,
		maxChecks: 4,
		variants: ["docs", "current", "minimal"],
		taskIds: [],
	};
	const numeric = {
		"--runs": "runs",
		"--concurrency": "concurrency",
		"--timeout-ms": "timeoutMs",
		"--max-actions": "maxActions",
		"--max-checks": "maxChecks",
	};
	for (let index = 0; index < args.length; ++index) {
		const argument = args[index];
		if (argument === "--fixture") {
			options.fixture = true;
		} else if (argument === "--help") {
			options.help = true;
		} else if (numeric[argument]) {
			options[numeric[argument]] = Number(args[++index]);
		} else if (argument === "--seeds") {
			options.seeds = args[++index].split(",").map(Number);
		} else if (argument === "--variants") {
			options.variants = args[++index].split(",");
		} else if (argument === "--task") {
			options.taskIds.push(args[++index]);
		} else if (["--model", "--effort", "--output", "--suite"].includes(argument)) {
			options[argument.slice(2)] = args[++index];
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	for (const key of [...Object.values(numeric)]) {
		if (!Number.isSafeInteger(options[key]) || options[key] < 1) {
			throw new Error(`Invalid ${key}`);
		}
	}
	if (!options.seeds.length || options.seeds.some((seed) => !Number.isSafeInteger(seed))) {
		throw new Error("Invalid seeds");
	}
	if (!["original", "transfer", "ablation"].includes(options.suite)) {
		throw new Error("Invalid suite");
	}
	if (
		!options.variants.length ||
		options.variants.some(
			(variant) =>
				!["docs", "current", "minimal", ...(options.suite === "ablation" ? ["helpers"] : [])].includes(variant),
		)
	) {
		throw new Error("Invalid variants");
	}
	if (
		new Set(options.seeds).size !== options.seeds.length ||
		new Set(options.variants).size !== options.variants.length
	) {
		throw new Error("Seeds and variants must be unique to preserve paired observation identity.");
	}
	return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main()
		.catch((error) => {
			process.stderr.write(`${error.stack}\n`);
			process.exitCode = 1;
		})
		.finally(cleanupRuntime);
}
