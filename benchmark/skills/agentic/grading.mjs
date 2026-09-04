import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareRuntime } from "./runtime.mjs";

const taskRoot = path.dirname(fileURLToPath(import.meta.url));

/** Read trusted checks once so later host edits cannot affect a measured attempt. */
export async function freezeTask(task) {
	const shared = await readFile(path.join(taskRoot, "tasks", "_shared.mjs"), "utf8");
	const [smoke, hidden] = await Promise.all([
		readFile(path.resolve(taskRoot, task.smokePath), "utf8"),
		readFile(path.resolve(taskRoot, task.hiddenPath), "utf8"),
	]);

	return deepFreeze({
		...task,
		programs: {
			hidden: createTestProgram(hidden, shared),
			smoke: createTestProgram(smoke, shared),
		},
	});
}

/** Compile and execute an artifact without inspecting its documentation route. */
export async function gradeArtifact({ root, task, source, hidden = false, timeoutMs = 8_000, runtime: savedRuntime }) {
	const started = performance.now();
	const directory = await mkdtemp(path.join(temporaryRoot(), "serve-tools-artifact-"));
	const result = {
		compile: false,
		contracts: false,
		smoke: false,
		hidden: hidden ? false : null,
		feedback: "",
		elapsedMs: 0,
	};

	try {
		if (typeof source !== "string" || !source.trim()) {
			result.feedback = "Write solution.ts before checking it.";
			return result;
		}

		const runtime = savedRuntime ?? (await prepareRuntime(root));

		await symlink(runtime.nodeModules, path.join(directory, "node_modules"), "dir");
		await writeFile(path.join(directory, "package.json"), '{"type":"module"}\n');
		await writeFile(path.join(directory, "solution.ts"), source);
		await writeFile(
			path.join(directory, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					lib: ["ESNext", "DOM", "DOM.Iterable"],
					module: "ESNext",
					moduleResolution: "Bundler",
					strict: true,
					skipLibCheck: true,
					target: "ESNext",
					outDir: "output",
					types: ["node"],
					noEmitOnError: true,
				},
				files: ["solution.ts"],
			}),
		);

		const compiled = await runCompiler(runtime, directory);
		result.compile = compiled.code === 0;
		result.feedback = cleanFeedback(compiled.output, root, directory);
		if (!result.compile) {
			return result;
		}

		const solution = path.join(directory, "output/solution.js");
		const emitted = await readFile(solution, "utf8");

		result.contracts = hasRequiredImports(emitted, task.requiredRuntimeImports);
		if (!result.contracts) {
			result.feedback = "Compiled solution does not retain an import for every required package capability.";

			return result;
		}

		const smoke = await runTest(runtime, directory, task, "smoke", solution, timeoutMs);
		result.smoke = smoke.code === 0;
		result.feedback = result.smoke
			? "TypeScript compilation, required package imports, and public smoke checks passed."
			: cleanFeedback(smoke.output, root, directory);

		if (hidden) {
			const checked = await runTest(runtime, directory, task, "hidden", solution, timeoutMs);
			result.hidden = checked.code === 0;
			result.hiddenFeedback = cleanFeedback(checked.output, root, directory);
		}
		return result;
	} finally {
		result.elapsedMs = performance.now() - started;
		await rm(directory, { force: true, recursive: true });
	}
}

function temporaryRoot() {
	return process.platform === "darwin" ? "/private/tmp" : os.tmpdir();
}

async function runTest(runtime, directory, task, variant, solution, timeoutMs) {
	const program = task.programs?.[variant] ?? (await loadTestProgram(task, variant));

	return runRestrictedNode(runtime, directory, ["--input-type=module", "-", solution], { input: program, timeoutMs });
}

async function loadTestProgram(task, variant) {
	const shared = await readFile(path.join(taskRoot, "tasks", "_shared.mjs"), "utf8");
	const testPath = variant === "hidden" ? task.hiddenPath : task.smokePath;
	const source = await readFile(path.resolve(taskRoot, testPath), "utf8");

	return createTestProgram(source, shared);
}

function createTestProgram(source, shared) {
	const sharedURI = `data:text/javascript;base64,${Buffer.from(shared).toString("base64")}`;

	return source.replace(/from\s+["']\.\.\/_shared\.mjs["'];?/g, `from ${JSON.stringify(sharedURI)};`);
}

function runCompiler(runtime, directory) {
	return runProcess(process.execPath, [runtime.tsc, "-p", directory], { cwd: directory });
}

async function runRestrictedNode(runtime, directory, args, { input, timeoutMs = 30_000 } = {}) {
	const arguments_ = [
		"--permission",
		`--allow-fs-read=${directory}`,
		`--allow-fs-read=${runtime.directory}`,
		...args,
	];

	return runProcess(process.execPath, arguments_, { cwd: directory, input, timeoutMs });
}

function hasRequiredImports(source, groups = []) {
	if (!Array.isArray(groups) || groups.length === 0) {
		return true;
	}

	const imports = new Set();

	for (const match of source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)) {
		imports.add(match[1]);
	}

	for (const match of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
		imports.add(match[1]);
	}

	return groups.every((group) => Array.isArray(group) && group.some((specifier) => imports.has(specifier)));
}

/** Run a bounded local validator without forwarding account credentials. */
export function runProcess(command, args, { cwd, input, timeoutMs = 30_000 } = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			env: { PATH: process.env.PATH, TMPDIR: os.tmpdir(), LANG: "en_US.UTF-8" },
			stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
		});
		let output = "";
		let timedOut = false;
		const append = (chunk) => {
			output = (output + chunk).slice(-20_000);
		};
		child.stdout.on("data", append);
		child.stderr.on("data", append);
		if (input !== undefined) {
			child.stdin.end(input);
		}
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ code, timedOut, output: timedOut ? `Validator exceeded ${timeoutMs}ms.\n${output}` : output });
		});
	});
}

function cleanFeedback(output, root, directory) {
	return output.replaceAll(directory, "<artifact>").replaceAll(root, "<packages>").slice(-8_000);
}

function deepFreeze(value) {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);

		for (const nested of Object.values(value)) {
			deepFreeze(nested);
		}
	}

	return value;
}
