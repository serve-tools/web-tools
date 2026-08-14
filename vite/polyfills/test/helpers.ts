import type { Plugin, Rollup } from "vite";
import { build } from "vite";

const VIRTUAL_PREFIX = "virtual:test:";
const RESOLVED_PREFIX = "\0" + VIRTUAL_PREFIX;

/**
 * Virtual file plugin - serves files from a JS object
 * Uses the \0 prefix convention for virtual module IDs
 */
export function virtualFiles(files: Record<string, string>): Plugin {
	// Normalize keys (strip leading ./)
	const normalizedFiles = new Map<string, string>();

	for (const [key, value] of Object.entries(files)) {
		const clean = key.startsWith("./") ? key.slice(2) : key;

		normalizedFiles.set(clean, value);
	}

	return {
		name: "test:virtual-files",
		enforce: "pre",

		resolveId(id) {
			// Handle virtual: prefixed IDs (used as entry points)
			if (id.startsWith(VIRTUAL_PREFIX)) {
				return RESOLVED_PREFIX + id.slice(VIRTUAL_PREFIX.length);
			}
			// Handle relative imports
			const clean = id.startsWith("./") ? id.slice(2) : id;
			if (normalizedFiles.has(clean)) {
				return RESOLVED_PREFIX + clean;
			}
		},

		load(id) {
			if (id.startsWith(RESOLVED_PREFIX)) {
				const key = id.slice(RESOLVED_PREFIX.length);
				return normalizedFiles.get(key);
			}
		},
	};
}

/**
 * Options for running a test build
 */
export interface BuildTestOptions {
	/** Virtual files to include in the build */
	files: Record<string, string>;

	/** Entry point file name (default: 'index.js') */
	entry?: string;

	/** Additional plugins to include */
	plugins?: Plugin[];
}

/**
 * Result from a test build
 */
export interface BuildTestResult {
	/** Raw Rollup output */
	output: Rollup.RollupOutput["output"];

	/** Get a chunk by filename prefix */
	getChunk(name: string): string | undefined;
}

export interface TransformTestOptions {
	/** Source passed through Vite's transform pipeline. */
	code: string;

	/** Virtual source identifier (default: `index.js`). */
	id?: string;

	/** Plugins that run before the capture plugin. */
	plugins: Plugin[];
}

/**
 * Run a Vite build with virtual files for testing
 *
 * @param options - Build options including virtual files and plugins
 * @returns Build result with helper methods
 *
 * @example
 * ```ts
 * const result = await buildTest({
 *   files: { 'index.js': 'export const x = 1' },
 *   plugins: [vitePolyfills()]
 * })
 * expect(result.getChunk('index')).toContain('x')
 * ```
 */
export async function buildTest(options: BuildTestOptions): Promise<BuildTestResult> {
	const { files, entry = "index.js", plugins = [] } = options;

	const result = await build({
		logLevel: "silent",
		build: {
			write: false,
			minify: false,
			rollupOptions: {
				// Use virtual: prefix so our plugin can resolve it
				input: VIRTUAL_PREFIX + entry,
				// Preserve exports to prevent tree-shaking
				preserveEntrySignatures: "exports-only",
				output: {
					// Consistent output for easier testing
					entryFileNames: "[name].js",
					chunkFileNames: "[name].js",
					assetFileNames: "[name].[ext]",
				},
			},
		},
		plugins: [virtualFiles(files), ...plugins],
	});

	// Handle both single and array output (lib mode vs normal)
	const output = Array.isArray(result) ? result[0].output : (result as Rollup.RollupOutput).output;

	return {
		output,

		getChunk(name: string) {
			const chunk = output.find((o): o is Rollup.OutputChunk => o.type === "chunk" && o.fileName.includes(name));
			return chunk?.code;
		},
	};
}

/** Run source through Vite and capture it after the supplied plugins transform it. */
export async function transformTest(options: TransformTestOptions): Promise<string> {
	const { code, id = "index.js", plugins } = options;
	const targetId = RESOLVED_PREFIX + id;

	let transformedCode: string | undefined;

	await buildTest({
		entry: id,
		files: { [id]: code },
		plugins: [
			...plugins,
			{
				name: "test:capture-transform",
				enforce: "pre",
				transform(currentCode, currentId) {
					if (currentId !== targetId) {
						return null;
					}

					transformedCode = currentCode;

					return /\.[cm]?[jt]sx?(?:\?|$)/.test(id) ? "export {};" : null;
				},
			},
		],
	});

	if (transformedCode === undefined) {
		throw new Error(`Vite did not transform ${id}`);
	}

	return transformedCode;
}
