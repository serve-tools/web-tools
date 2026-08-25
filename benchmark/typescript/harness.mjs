import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Resolves the TypeScript installation used by a benchmark target.
 *
 * This intentionally avoids resolving TypeScript from the temporary fixture,
 * whose ancestors do not contain the workspace dependency.
 */
export function resolveTypeScript(root) {
	const require = createRequire(path.join(root, "package.json"));
	const packageJson = require("typescript/package.json");
	const packageRoot = path.dirname(require.resolve("typescript/package.json"));

	return {
		compiler: path.join(packageRoot, "bin", "tsc"),
		editor: pathToFileURL(require.resolve("typescript/unstable/sync")).href,
		version: packageJson.version,
	};
}

/** Runs a callback with an automatically removed temporary fixture directory. */
export async function withTemporaryRoot(prefix, callback) {
	const temporaryRoot = await mkdtemp(path.join(tmpdir(), `serve-tools-${prefix}-types-`));

	try {
		return await callback(temporaryRoot);
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
}

/** Parses a package benchmark's count and editor options without changing its CLI contract. */
export function parseBenchmarkOptions({ arguments_, countFlag, defaultCounts, environment, help, label }) {
	const options = {
		editor: false,
		counts: parseCounts(process.env[environment] ?? defaultCounts, label),
	};

	for (let index = 0; index < arguments_.length; ++index) {
		const argument = arguments_[index];

		if (argument === "--editor") {
			options.editor = true;
			continue;
		}

		if (argument === countFlag) {
			const value = arguments_[++index];
			if (value === undefined) {
				throw new TypeError(`${countFlag} requires comma-separated positive ${label}`);
			}

			options.counts = parseCounts(value, label);
			continue;
		}

		if (argument === "--help" || argument === "-h") {
			console.log(help);
			process.exit(0);
		}

		throw new TypeError(`Unknown benchmark option: ${argument}`);
	}

	return options;
}

function parseCounts(value, label) {
	const counts = value.split(",").map((count) => Number(count.trim()));

	if (counts.length === 0 || counts.some((count) => !Number.isSafeInteger(count) || count < 1)) {
		throw new TypeError(`${label[0].toUpperCase()}${label.slice(1)} must be comma-separated positive integers`);
	}

	return counts;
}

/** Compiles a fixture with native extended diagnostics and a comparable Go memory limit. */
export function compileTypeScript({ compiler, configuration, root }) {
	const result = spawnSync(
		process.execPath,
		[compiler, "--project", configuration, "--noEmit", "--extendedDiagnostics", "--pretty", "false"],
		{
			cwd: root,
			encoding: "utf8",
			env: { ...process.env, GOMEMLIMIT: process.env.GOMEMLIMIT ?? "768MiB" },
		},
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

/** Opens a fresh native TypeScript editor session and guarantees snapshot/API disposal. */
export async function withNativeEditor({ editor, fixture, projectError, root, run }) {
	const { API } = await import(editor);
	const api = new API({ cwd: root, collectTiming: true });
	let snapshot;

	try {
		snapshot = api.updateSnapshot({ openProjects: [fixture.configuration], openFiles: [fixture.source] });
		const project = snapshot.getProject(fixture.configuration);
		if (project === undefined) {
			throw new Error(projectError);
		}

		return await run({ api, project });
	} finally {
		snapshot?.dispose();
		api.close();
	}
}

/** Times a synchronous native editor request. */
export function timeEditorRequest(api, request) {
	api.resetTimingInfo();
	const result = request();

	return { result, timing: api.getTimingInfo() };
}

/** Reads the retained or cumulative Go heap estimate from a native editor heap profile. */
export function readNativeHeap({ profile, root, sample }) {
	const result = spawnSync(
		"go",
		["tool", "pprof", "-top", "-nodecount=1", "-unit=B", `-sample_index=${sample}`, profile],
		{ cwd: root, encoding: "utf8" },
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
