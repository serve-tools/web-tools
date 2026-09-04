import path from "node:path";
import { canonicalPath, hasSideEffects, readProjectPackages, resolveProjectExport } from "./exports.mjs";
import { createCompilerSession } from "./session.mjs";

/**
 * Opt-in Vite/Rolldown adapter; package publishing and CLI builds still use physical dist files.
 * @param {{ configFile?: string, cwd?: string, conditions?: readonly string[] }} [options]
 */
export function typescriptProject({ configFile = "tsconfig.json", cwd = process.cwd(), conditions = [] } = {}) {
	let compiler;
	let current;
	let packages;
	let sources = new Map();
	let failure;
	let disposed = false;
	let disposal;
	let server;
	let firstBuild = true;
	let resolvedConfig;

	const buildStates = new Map();
	const statistics = { refreshes: 0, resolveCalls: 0, loadCalls: 0 };

	const initialization = createCompilerSession({ configFile: path.resolve(cwd, configFile), cwd })
		.then(async (value) => {
			compiler = value;
			if (!disposed) {
				await compile();
			}
		})
		.catch(async (error) => {
			failure = error;
			await compiler?.dispose();
			throw error;
		});

	// Observe eager initialization immediately; host hooks still receive its original rejection.
	let pending = initialization.catch(() => {});

	async function compile(fileChanges) {
		try {
			const next = await compiler.refresh(fileChanges);
			const nextPackages = await readProjectPackages(next.projects);
			const nextSources = new Map();

			for (const [id, output] of next.outputs) {
				const source = output.sourceFileName ?? output.sourceFiles?.[0];

				if (source && isJavaScript(id)) {
					nextSources.set(await canonicalPath(source), id);
				}
			}

			current = next;
			packages = nextPackages;
			sources = nextSources;
			failure = undefined;

			++statistics.refreshes;

			return current;
		} catch (error) {
			failure = error;

			throw error;
		}
	}

	function refresh(fileChanges) {
		const work = pending.then(async () => {
			await initialization;

			if (disposed) {
				throw new Error("TypeScript adapter is disposed");
			}

			return compile(fileChanges);
		});

		pending = work.catch(() => {});

		return work;
	}

	function dispose() {
		if (disposal) {
			return disposal;
		}

		disposed = true;

		disposal = (async () => {
			await pending;
			await compiler?.dispose();
			buildStates.clear();
		})();

		return disposal;
	}

	// Reference/config changes can introduce new package names and output directories.
	// Native filters reject unsupported forms; handlers restrict interception to the current graph.
	const resolutionFilter = /^(?:@[^/]+\/|[A-Za-z0-9_][^/:\\]*(?:\/|$)|\.{1,2}[\\/]|[\\/]|[A-Za-z]:[\\/])/;
	const outputFilter = /^(?:[\\/]|[A-Za-z]:[\\/]).*\.[cm]?js(?:[?#]|$)/;
	const roots = () => [...new Set(current.projects.map((project) => path.dirname(project.configFile)))];
	const state = () => ({ generation: current, packageMap: packages, sourceMap: sources });

	function isOutput(id, generation = current) {
		return generation.projects.some(({ options }) => {
			if (!options.outDir) {
				return false;
			}

			const relative = path.relative(options.outDir, id);

			return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
		});
	}

	async function ready() {
		await initialization;

		let work;

		do {
			work = pending;

			await work;
		} while (work !== pending);

		if (disposed) {
			throw new Error("TypeScript adapter is disposed");
		}

		if (failure) {
			throw failure;
		}
	}

	function sideEffects(id, packageMap = packages) {
		const pkg = [...packageMap.values()]
			.sort((a, b) => b.root.length - a.root.length)
			.find(({ root }) => {
				const relative = path.relative(root, id);
				return !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
			});

		return pkg ? hasSideEffects(pkg.manifest.sideEffects, path.relative(pkg.root, id)) : true;
	}

	function relevant(file) {
		const normalized = normalize(file);

		if (/(?:^|\/)(?:node_modules|\.git|coverage|dist|test-results|playwright-report)(?:\/|$)/.test(normalized)) {
			return false;
		}

		if (isOutput(file) || file.endsWith(".tsbuildinfo")) {
			return false;
		}

		return (
			roots().some((root) => file === root || file.startsWith(`${root}${path.sep}`)) ||
			current.watchedFiles?.includes(file)
		);
	}

	const plugin = {
		name: "typescript-project-memory",
		enforce: "pre",
		api: {
			refresh,
			dispose,
			get generation() {
				return current;
			},
			get error() {
				return failure;
			},
			get statistics() {
				return { ...statistics, compiler: current?.timing };
			},
		},
		async config(config) {
			await ready();

			const result = { optimizeDeps: { exclude: [...packages.keys()] } };

			if (config.server?.watch !== null) {
				result.server = {
					watch: {
						// Settle writes before Chokidar's change-event throttle can discard their final event.
						awaitWriteFinish: config.server?.watch?.awaitWriteFinish ?? {
							stabilityThreshold: 50,
							pollInterval: 10,
						},
					},
				};
			}

			return result;
		},
		configResolved(config) {
			resolvedConfig = config;
		},
		async configureServer(value) {
			await ready();

			server = value;

			server.watcher.add(roots());

			server.httpServer?.once("close", () => {
				void dispose().catch((error) => value.config.logger.error(String(error)));
			});
		},
		async buildStart() {
			await initialization;

			if (!firstBuild) {
				await refresh();
			}

			firstBuild = false;

			await ready();

			if (!server) {
				buildStates.set(this.environment ?? "rolldown", state());
			}

			for (const file of current.watchedFiles ??
				current.projects.flatMap((project) => [project.configFile, ...project.rootNames])) {
				this.addWatchFile(file);
			}
		},
		buildEnd() {
			buildStates.delete(this.environment ?? "rolldown");
		},
		resolveId: {
			filter: { id: resolutionFilter },
			async handler(specifier, importer, options = {}) {
				++statistics.resolveCalls;

				await ready();

				const { generation, packageMap, sourceMap } =
					buildStates.get(this.environment ?? "rolldown") ?? state();
				const environmentConditions = this.environment?.config.resolve.conditions ??
					resolvedConfig?.resolve.conditions ?? ["module"];
				const activeConditions = new Set([
					options.kind === "require-call" || options.custom?.["vite:resolve"]?.isRequire
						? "require"
						: "import",
					...conditions,
					...environmentConditions.map((condition) =>
						condition === "development|production"
							? resolvedConfig?.isProduction
								? "production"
								: "development"
							: condition,
					),
				]);
				const clean = specifier.split(/[?#]/, 1)[0];
				const postfix = specifier.slice(clean.length);
				const publicExport = await resolveProjectExport(packageMap, clean, activeConditions);

				if (publicExport) {
					if (/\.d\.[cm]?ts$/.test(publicExport.id)) {
						throw new Error(`Declaration is not a runtime export: ${specifier}`);
					}

					if (isJavaScript(publicExport.id) && !generation.outputs.has(publicExport.id)) {
						throw new Error(`No compiler output for public export: ${specifier} (${publicExport.id})`);
					}

					return { ...publicExport, id: publicExport.id + postfix };
				}

				const importerPath = importer?.split(/[?#]/, 1)[0];
				const candidate = path.isAbsolute(clean)
					? clean
					: importerPath && clean.startsWith(".")
						? path.resolve(path.dirname(importerPath), clean)
						: undefined;

				if (!candidate) {
					return null;
				}

				const id = await canonicalPath(candidate);
				const sourceOutput = sourceMap.get(id);

				if (sourceOutput) {
					return { id: sourceOutput + postfix, moduleSideEffects: sideEffects(sourceOutput, packageMap) };
				}

				const choices = [id, `${id}.js`, `${id}.mjs`, path.join(id, "index.js")];

				for (const choice of choices) {
					if (isJavaScript(choice) && generation.outputs.has(choice)) {
						return { id: choice + postfix, moduleSideEffects: sideEffects(choice, packageMap) };
					}
				}

				if (isJavaScript(id) && isOutput(id, generation)) {
					throw new Error(`Compiler output was removed: ${id}`);
				}

				return null;
			},
		},
		load: {
			filter: { id: outputFilter },
			async handler(id) {
				++statistics.loadCalls;

				await ready();

				const { generation, packageMap } = buildStates.get(this.environment ?? "rolldown") ?? state();
				const file = await canonicalPath(id.split(/[?#]/, 1)[0]);
				const output = generation.outputs.get(file);

				if (!output || !isJavaScript(file)) {
					return null;
				}

				const query = new URLSearchParams(id.split("?", 2)[1]?.split("#", 1)[0]);

				if (["url", "worker", "sharedworker"].some((kind) => query.has(kind))) {
					throw new Error(`The TypeScript plugin does not support asset or worker query imports: ${id}`);
				}

				if (query.has("raw")) {
					return {
						code: `export default ${JSON.stringify(output.text)};`,
						map: null,
						moduleSideEffects: false,
					};
				}

				const mapOutput = generation.outputs.get(`${file}.map`);

				let map = null;

				if (mapOutput) {
					map = JSON.parse(mapOutput.text);
					map.sources = map.sources.map((source) =>
						normalize(path.resolve(path.dirname(file), map.sourceRoot ?? "", source)),
					);
					map.sourceRoot = "";
					map.sourcesContent = await Promise.all(
						map.sources.map(
							async (source, index) =>
								map.sourcesContent?.[index] ??
								generation.sourcesContent.get(await canonicalPath(source)) ??
								null,
						),
					);
				}

				return {
					code: output.text.replace(/\n?\/\/# sourceMappingURL=.*(?:\r?\n)?$/, "\n"),
					map,
					moduleSideEffects: sideEffects(file, packageMap),
				};
			},
		},
		async hotUpdate(context) {
			await initialization;

			if (disposed) {
				throw new Error("TypeScript adapter is disposed");
			}

			const file = await canonicalPath(context.file);

			if (isOutput(file) || file.endsWith(".tsbuildinfo")) {
				return [];
			}

			if (!relevant(file)) {
				return;
			}

			const previous = current;

			await refresh({
				[{ create: "created", update: "changed", delete: "deleted" }[context.type]]: [file],
			});

			await ready();

			server?.watcher.add(roots());

			const graph = this.environment.moduleGraph;
			const modules = new Set(context.modules);

			for (const [id, module] of graph.idToModuleMap) {
				if (!path.isAbsolute(id.split(/[?#]/, 1)[0])) {
					continue;
				}

				const file = await canonicalPath(id.split(/[?#]/, 1)[0]);

				if (previous.outputs.has(file) || current.outputs.has(file)) {
					graph.invalidateModule(module, new Set(), context.timestamp, true);

					modules.add(module);
				}
			}

			return [...modules];
		},
		async closeBundle() {
			await dispose();
		},
		async closeWatcher() {
			await dispose();
		},
	};

	return plugin;
}

function isJavaScript(file) {
	return /\.[cm]?js$/.test(file);
}
function normalize(file) {
	return file.split(path.sep).join("/");
}
