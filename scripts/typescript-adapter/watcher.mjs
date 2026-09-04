import { createHash } from "node:crypto";
import { watch } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createCompilerSession } from "./session.mjs";

/** Watch a configured project with native directory watchers and serialized reconciliation. */
export async function watchCompilerProject({
	configFile,
	cwd,
	onUpdate,
	onError = () => {},
	signal,
	debounceMilliseconds = 20,
}) {
	const session = await createCompilerSession({ configFile, cwd });
	const watches = new Map();
	let files = new Map();
	let generation;
	let requested = 0;
	let handled = 0;
	let working;
	let timer;
	let closed = false;
	let closing;
	let lastError;
	let needsNotification = false;

	async function reportError(error) {
		lastError = error;
		try {
			await onError(error);
		} catch (callbackError) {
			lastError = callbackError;
		}
	}

	function ignored(file) {
		if (/(?:^|[\\/])(?:node_modules|\.git|dist|coverage|playwright-report|test-results)(?:[\\/]|$)/.test(file)) {
			return true;
		}
		if (file.endsWith(".tsbuildinfo")) {
			return true;
		}
		return generation?.projects.some(({ options }) => {
			if (!options.outDir) {
				return false;
			}
			const relative = path.relative(options.outDir, file);
			return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
		});
	}

	async function scan(directory, result) {
		let entries;
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch (error) {
			if (error.code === "ENOENT") {
				return result;
			}
			throw error;
		}
		for (const entry of entries) {
			const file = path.join(directory, entry.name);
			if (ignored(file)) {
				continue;
			}
			if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json)$/.test(file)) {
				try {
					result.set(
						file,
						createHash("sha256")
							.update(await readFile(file))
							.digest("hex"),
					);
				} catch (error) {
					if (error.code !== "ENOENT") {
						throw error;
					}
				}
			}
		}
		return result;
	}

	async function readInputs() {
		const result = new Map();
		for (const directory of watches.keys()) {
			await scan(directory, result);
		}
		return result;
	}

	function schedule(_event, filename, directory) {
		if (closed || (filename && ignored(path.join(directory, String(filename))))) {
			return;
		}
		++requested;
		clearTimeout(timer);
		timer = setTimeout(() => {
			void pump();
		}, debounceMilliseconds);
	}

	async function updateWatches() {
		if (closed) {
			return;
		}

		const desired = new Map();
		for (const project of generation.projects) {
			const directory = path.dirname(project.configFile);
			desired.set(directory, desired.get(directory) || project.rootNames.length > 0);
		}
		for (const file of generation.watchedFiles ?? []) {
			if (ignored(file)) {
				continue;
			}
			const directory = path.dirname(file);
			if (
				[...desired].some(
					([root, recursive]) => recursive && (file === root || file.startsWith(`${root}${path.sep}`)),
				)
			) {
				continue;
			}
			try {
				if (!(await stat(directory)).isDirectory()) {
					continue;
				}
			} catch (error) {
				if (error.code === "ENOENT") {
					continue;
				}
				throw error;
			}
			desired.set(directory, desired.get(directory) ?? false);
		}

		const desiredEntries = [...desired]
			.sort(([left], [right]) => left.length - right.length)
			.filter(
				([directory]) =>
					![...desired].some(
						([root, recursive]) =>
							recursive && root !== directory && directory.startsWith(`${root}${path.sep}`),
					),
			);
		if (closed) {
			return;
		}
		const desiredDirectories = new Map();
		async function collect(directory, recursive) {
			try {
				const identity = await stat(directory);
				if (!identity.isDirectory()) {
					return;
				}
				desiredDirectories.set(directory, identity);
				if (!recursive) {
					return;
				}
				for (const entry of await readdir(directory, { withFileTypes: true })) {
					const child = path.join(directory, entry.name);
					if (entry.isDirectory() && !ignored(child)) {
						await collect(child, true);
					}
				}
			} catch (error) {
				if (error.code !== "ENOENT") {
					throw error;
				}
			}
		}
		for (const [directory, recursive] of desiredEntries) {
			await collect(directory, recursive);
		}
		if (closed) {
			return;
		}

		for (const [directory, entry] of watches) {
			const identity = desiredDirectories.get(directory);
			if (identity?.dev === entry.dev && identity.ino === entry.ino) {
				continue;
			}
			entry.watcher.close();
			watches.delete(directory);
		}
		for (const [directory, { dev, ino }] of desiredDirectories) {
			if (watches.has(directory)) {
				continue;
			}
			try {
				// Linux recursive fs.watch retains file watches on old inodes after atomic saves.
				// Watching directories observes replacement files without retaining their inodes.
				const watcher = watch(directory, (event, file) => schedule(event, file, directory));
				watcher.on("error", (error) => {
					void reportError(error);
				});
				watches.set(directory, { dev, ino, watcher });
			} catch (error) {
				if (error.code !== "ENOENT") {
					throw error;
				}
			}
		}
	}

	function pump() {
		if (working || closed) {
			return working;
		}
		working = (async () => {
			while (!closed && handled < requested) {
				const revision = requested;
				try {
					await updateWatches();
					const next = await readInputs();
					if (closed) {
						break;
					}
					const changes = { created: [], changed: [], deleted: [] };
					for (const [file, hash] of next) {
						if (!files.has(file)) {
							changes.created.push(file);
						} else if (files.get(file) !== hash) {
							changes.changed.push(file);
						}
					}
					for (const file of files.keys()) {
						if (!next.has(file)) {
							changes.deleted.push(file);
						}
					}
					files = next;
					if (Object.values(changes).some((list) => list.length)) {
						const result = await session.refresh(changes);
						if (closed) {
							break;
						}
						generation = result;
						await updateWatches();
						lastError = undefined;
						needsNotification = true;
					}
				} catch (error) {
					lastError = error;
					needsNotification = true;
				}
				if (!closed && revision === requested && needsNotification) {
					needsNotification = false;
					if (lastError) {
						await reportError(lastError);
					} else {
						try {
							await onUpdate(generation);
						} catch (error) {
							await reportError(error);
						}
					}
				}
				handled = revision;
			}
		})().finally(() => {
			working = undefined;
		});
		return working;
	}

	function close() {
		return (closing ??= (async () => {
			closed = true;
			clearTimeout(timer);
			for (const { watcher } of watches.values()) {
				watcher.close();
			}
			watches.clear();
			signal?.removeEventListener("abort", abort);
			await session.dispose();
		})());
	}

	function abort() {
		void close().catch((error) => reportError(error));
	}

	try {
		generation = await session.refresh();
		await updateWatches();
		files = await readInputs();
		await onUpdate(generation);
		if (signal?.aborted) {
			await close();
		} else {
			signal?.addEventListener("abort", abort, { once: true });
		}
	} catch (error) {
		await close();
		throw error;
	}
	return {
		close,
		get generation() {
			return generation;
		},
		get error() {
			return lastError;
		},
		get closed() {
			return closed;
		},
	};
}
