import { access, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { compilerRange, supportsCompilerVersion } from "./compiler-version.mjs";

const diagnosticMethods = [
	"getConfigFileParsingDiagnostics",
	"getSyntacticDiagnostics",
	"getProgramDiagnostics",
	"getBindDiagnostics",
	"getGlobalDiagnostics",
	"getSemanticDiagnostics",
	"getDeclarationDiagnostics",
];

/** An unsuccessful compiler-session refresh. */
export class CompilerSessionError extends Error {
	constructor(message, { diagnostics = [], timing, cause } = {}) {
		super(message, { cause });
		this.name = "CompilerSessionError";
		this.diagnostics = diagnostics;
		this.timing = timing;
	}
}

/** Create a persistent TypeScript compiler session for one referenced project graph. */
export async function createCompilerSession({ configFile, cwd = process.cwd() }) {
	if (!configFile) {
		throw new TypeError("configFile is required");
	}

	const manifest = JSON.parse(await readFile(new URL(import.meta.resolve("typescript/package.json")), "utf8"));
	const compilerVersion = manifest.version;

	if (!supportsCompilerVersion(compilerVersion)) {
		throw new Error(
			`@serve-tools/rolldown-typescript requires TypeScript ${compilerRange}; found ${compilerVersion}. Install a supported TypeScript version.`,
		);
	}

	const { API, formatDiagnostics } = await import("typescript/unstable/async");
	const canonicalCwd = await canonicalPath(cwd);
	const canonicalConfigFile = await canonicalPath(path.resolve(canonicalCwd, configFile));

	let api = new API({ cwd: canonicalCwd, collectTiming: true });
	let activeSnapshot;
	let disposed = false;
	let disposeRequested = false;
	let generation = 0;
	let openedConfigs = new Set();
	let pendingChanges = new Map();
	let operation = Promise.resolve();

	const serialize = (callback) => {
		const result = operation.then(callback, callback);

		operation = result.catch(() => {});

		return result;
	};

	const refresh = (fileChanges) => {
		if (disposeRequested) {
			return Promise.reject(new Error("Compiler session is disposed"));
		}

		return serialize(async () => {
			if (disposed) {
				throw new Error("Compiler session is disposed");
			}

			pendingChanges = mergeFileChanges(pendingChanges, await normalizeFileChanges(fileChanges, canonicalCwd));

			api ??= new API({ cwd: canonicalCwd, collectTiming: true });

			await api.resetTimingInfo();

			const started = performance.now();
			const phase = { configuration: started, diagnostics: 0, emit: 0 };
			const recovery = { restartCount: 0, apiTiming: undefined };

			let graph;

			try {
				while (true) {
					graph = await readConfigGraph(api, canonicalConfigFile);

					const configDiagnostics = uniqueDiagnostics(graph.flatMap(({ parsed }) => parsed.errors));

					if (configDiagnostics.length) {
						phase.diagnostics = performance.now();

						throw await diagnosticError(
							api,
							configDiagnostics,
							phase,
							started,
							recovery,
							formatDiagnostics,
						);
					}

					const nextConfigs = new Set(graph.map(({ configFile: file }) => file));
					const openProjects = [...nextConfigs].filter((file) => !openedConfigs.has(file));
					const closeProjects = [...openedConfigs].filter((file) => !nextConfigs.has(file));
					const changes = materializeFileChanges(pendingChanges);
					const previousSnapshot = activeSnapshot;

					activeSnapshot = await api.updateSnapshot({
						...(openProjects.length ? { openProjects } : {}),
						...(closeProjects.length ? { closeProjects } : {}),
						...(changes ? { fileChanges: changes } : {}),
					});

					openedConfigs = nextConfigs;

					await previousSnapshot?.dispose();

					const inconsistentConfig = await findInconsistentRoots(api, activeSnapshot, graph);

					if (!inconsistentConfig) {
						break;
					}

					if (recovery.restartCount) {
						throw new Error(
							`TypeScript retained inconsistent project roots after restart: ${inconsistentConfig}`,
						);
					}

					// Native snapshots can retain stale include-glob roots despite file notifications.
					await activeSnapshot.dispose();

					activeSnapshot = undefined;

					openedConfigs.clear();

					recovery.apiTiming = await api.getTimingInfo();

					try {
						await api.close();
					} finally {
						api = undefined;
					}

					api = new API({ cwd: canonicalCwd, collectTiming: true });

					++recovery.restartCount;
				}

				pendingChanges = new Map();

				phase.diagnostics = performance.now();

				const projects = [];
				const watchedFiles = new Set();
				const projectObjects = [];

				for (const { configFile: file } of graph) {
					const project = activeSnapshot.getProject(file);

					if (!project) {
						throw new Error(`TypeScript did not load configured project ${file}`);
					}

					projectObjects.push(project);

					const metadata = await projectMetadata(project);

					projects.push(metadata);

					for (const watched of metadata.watchedFiles) {
						watchedFiles.add(watched);
					}
				}

				const diagnostics = uniqueDiagnostics(
					(
						await Promise.all(
							projectObjects.flatMap(({ program }) =>
								diagnosticMethods.map(async (method) => [...(await program[method]())]),
							),
						)
					).flat(),
				);

				if (diagnostics.length) {
					throw await diagnosticError(api, diagnostics, phase, started, recovery, formatDiagnostics);
				}

				phase.emit = performance.now();

				const outputs = new Map();
				const sourcesContent = new Map();

				for (let index = 0; index < projectObjects.length; ++index) {
					if (projects[index].options.noEmit || projects[index].rootNames.length === 0) {
						continue;
					}

					const result = await projectObjects[index].program.emitToString();

					if (result.emitSkipped || result.diagnostics.length) {
						const emitDiagnostics = uniqueDiagnostics(result.diagnostics);

						if (emitDiagnostics.length) {
							throw await diagnosticError(
								api,
								emitDiagnostics,
								phase,
								started,
								recovery,
								formatDiagnostics,
							);
						}

						throw new Error(`TypeScript skipped emit for ${projects[index].configFile}`);
					}

					for (const [fileName, output] of result.outputFiles) {
						if (!output.sourceFileName) {
							throw new Error(
								`TypeScript did not associate emitted output ${fileName} with a source file`,
							);
						}

						const canonicalFileName = await canonicalPath(fileName);
						const sourceFileName = await canonicalPath(output.sourceFileName);

						let sourceText = sourcesContent.get(sourceFileName);

						if (sourceText === undefined) {
							const sourceFile = await projectObjects[index].program.getSourceFile(output.sourceFileName);

							if (!sourceFile) {
								throw new Error(`TypeScript did not retain emitted source ${sourceFileName}`);
							}

							sourceText = sourceFile.text;

							sourcesContent.set(sourceFileName, sourceText);
						}

						if (outputs.has(canonicalFileName)) {
							throw new Error(`Multiple configured projects emitted ${canonicalFileName}`);
						}

						outputs.set(
							canonicalFileName,
							Object.freeze({
								text: output.text,
								sourceFileName,
								sourceFiles: Object.freeze([sourceFileName]),
								sourceText,
								projectConfigFile: projects[index].configFile,
							}),
						);
					}
				}

				const timing = await finishTiming(api, phase, started, recovery);

				return Object.freeze({
					generation: ++generation,
					projects: Object.freeze(projects),
					outputs,
					sourcesContent,
					diagnostics: Object.freeze([]),
					watchedFiles: Object.freeze([...watchedFiles].sort()),
					timing,
				});
			} catch (error) {
				if (error instanceof CompilerSessionError) {
					throw error;
				}

				throw new CompilerSessionError(error.message, {
					cause: error,
					timing: await finishTiming(api, phase, started, recovery),
				});
			}
		});
	};

	const dispose = () => {
		if (disposeRequested) {
			return operation;
		}

		disposeRequested = true;

		return serialize(async () => {
			if (disposed) {
				return;
			}

			disposed = true;

			try {
				await activeSnapshot?.dispose();
			} finally {
				activeSnapshot = undefined;
				openedConfigs.clear();
				pendingChanges.clear();

				await api?.close();
			}
		});
	};

	return Object.freeze({
		compilerVersion,
		configFile: canonicalConfigFile,
		cwd: canonicalCwd,
		refresh,
		dispose,
		[Symbol.asyncDispose]: dispose,
	});
}

async function readConfigGraph(api, rootConfigFile) {
	const graph = [];
	const visited = new Set();

	const visit = async (configFile) => {
		const canonicalConfigFile = await canonicalPath(configFile);

		if (visited.has(canonicalConfigFile)) {
			return;
		}

		visited.add(canonicalConfigFile);

		const parsed = await api.parseConfigFile(canonicalConfigFile);

		graph.push({ configFile: canonicalConfigFile, parsed });

		for (const reference of parsed.projectReferences ?? []) {
			const referencedConfig = reference.path.endsWith(".json")
				? reference.path
				: path.join(reference.path, "tsconfig.json");

			await visit(referencedConfig);
		}
	};

	await visit(rootConfigFile);

	return graph;
}

async function projectMetadata(project) {
	const configFile = await canonicalPath(project.configFileName);
	const configDirectory = path.dirname(configFile);
	const rootNames = await Promise.all(project.parsedCommandLine.fileNames.map((file) => canonicalPath(file)));
	const configFileNames = await Promise.all(
		(await project.program.getConfigFileNames()).map((file) => canonicalPath(file)),
	);
	const packageFile = await findPackageFile(configDirectory);
	const watchedFiles = new Set([...rootNames, ...configFileNames]);

	if (packageFile) {
		watchedFiles.add(packageFile);
	}

	return Object.freeze({
		configFile,
		configDirectory,
		rootNames: Object.freeze(rootNames),
		options: Object.freeze({ ...project.parsedCommandLine.options }),
		projectReferences: Object.freeze(
			await Promise.all(
				(project.parsedCommandLine.projectReferences ?? []).map(async (reference) =>
					canonicalPath(
						reference.path.endsWith(".json") ? reference.path : path.join(reference.path, "tsconfig.json"),
					),
				),
			),
		),
		configFileNames: Object.freeze(configFileNames),
		packageFile,
		watchedFiles: Object.freeze([...watchedFiles].sort()),
	});
}

async function findInconsistentRoots(api, snapshot, graph) {
	const rootSet = async (files) =>
		new Set(await Promise.all(files.map(async (file) => api.getCanonicalFileName(await canonicalPath(file)))));

	for (const { configFile, parsed } of graph) {
		const project = snapshot.getProject(configFile);

		if (!project) {
			return configFile;
		}

		const [expected, actual] = await Promise.all([
			rootSet(parsed.fileNames),
			rootSet(project.parsedCommandLine.fileNames),
		]);

		if (expected.size !== actual.size || [...expected].some((file) => !actual.has(file))) {
			return configFile;
		}
	}

	return undefined;
}

async function findPackageFile(directory) {
	let current = directory;

	while (true) {
		const candidate = path.join(current, "package.json");

		try {
			await access(candidate);

			return canonicalPath(candidate);
		} catch (error) {
			if (error.code !== "ENOENT") {
				throw error;
			}
		}

		const parent = path.dirname(current);

		if (parent === current) {
			return undefined;
		}

		current = parent;
	}
}

async function canonicalPath(file) {
	const absolute = path.resolve(file);

	let existing = absolute;

	const suffix = [];

	while (true) {
		try {
			return path.join(await realpath(existing), ...suffix.reverse());
		} catch (error) {
			if (error.code !== "ENOENT") {
				throw error;
			}

			const parent = path.dirname(existing);

			if (parent === existing) {
				throw error;
			}

			suffix.push(path.basename(existing));

			existing = parent;
		}
	}
}

async function normalizeFileChanges(fileChanges, cwd) {
	const normalized = new Map();

	for (const kind of ["created", "changed", "deleted"]) {
		for (const file of fileChanges?.[kind] ?? []) {
			normalized.set(await canonicalPath(path.resolve(cwd, file)), kind);
		}
	}

	return normalized;
}

function mergeFileChanges(previous, next) {
	const merged = new Map(previous);

	for (const [file, kind] of next) {
		merged.set(file, kind);
	}

	return merged;
}

function materializeFileChanges(changes) {
	if (!changes.size) {
		return undefined;
	}

	const result = {};

	for (const [file, kind] of changes) {
		(result[kind] ??= []).push(file);
	}

	for (const [kind, files] of Object.entries(result)) {
		result[kind] = files.sort().map((file) => ({ uri: pathToFileURL(file).href }));
	}

	return result;
}

async function diagnosticError(api, diagnostics, phase, started, recovery, formatDiagnostics) {
	const timing = await finishTiming(api, phase, started, recovery);
	const formatted = formatDiagnostics(diagnostics, api).trim();

	return new CompilerSessionError(formatted || "TypeScript compilation failed", {
		diagnostics: Object.freeze(diagnostics),
		timing,
	});
}

function uniqueDiagnostics(diagnostics) {
	const unique = new Map();

	for (const diagnostic of diagnostics) {
		const key = JSON.stringify([
			diagnostic.code,
			diagnostic.category,
			diagnostic.fileName,
			diagnostic.start,
			diagnostic.length,
			diagnostic.messageText,
		]);

		unique.set(key, diagnostic);
	}

	return [...unique.values()].sort(
		(left, right) =>
			(left.fileName ?? "").localeCompare(right.fileName ?? "") ||
			(left.start ?? -1) - (right.start ?? -1) ||
			left.code - right.code,
	);
}

async function finishTiming(api, phase, started, recovery) {
	const finished = performance.now();
	const diagnosticsStarted = phase.diagnostics || finished;
	const emitStarted = phase.emit || finished;
	const apiTiming = mergeTimingInfo(recovery.apiTiming, await api?.getTimingInfo());

	return Object.freeze({
		configurationMs: diagnosticsStarted - phase.configuration,
		diagnosticsMs: emitStarted - diagnosticsStarted,
		emitMs: phase.emit ? finished - emitStarted : 0,
		totalMs: finished - started,
		apiRequestCount: apiTiming.totals.requestCount,
		apiRestartCount: recovery.restartCount,
		api: Object.freeze(apiTiming),
	});
}

function mergeTimingInfo(previous, current) {
	if (!previous) {
		return current;
	}

	if (!current) {
		return previous;
	}

	return {
		enabled: previous.enabled && current.enabled,
		totals: Object.fromEntries(
			Object.entries(current.totals).map(([key, value]) => [key, previous.totals[key] + value]),
		),
		// The pinned compiler retains the five most recent request samples.
		recentRequests: [...previous.recentRequests, ...current.recentRequests].slice(-5),
	};
}
