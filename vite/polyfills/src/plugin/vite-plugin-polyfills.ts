import { rolldownTransform } from "@jsxtools/rolldown-transform";
import type { Plugin } from "vite";
import { Visitor } from "vite";
import { builtinPolyfills } from "../polyfills/builtin-polyfills.js";
import type { Polyfill } from "./define-polyfill.js";

const PLUGIN_NAME = "vite-plugin-polyfills";
const VIRTUAL_PREFIX = "virtual:@serve-tools/vite-polyfill/";
const NULL_BYTE = "\0";
const NODE_MODULES_SEGMENT = /(?:^|[/\\])node_modules[/\\]/;
const BUILTIN_RUNTIME_PACKAGES = [
	"@serve-tools/polyfill-composites",
	"@serve-tools/polyfill-observable",
	"@serve-tools/ponyfill-composites",
	"@serve-tools/ponyfill-observable",
];

const isBuiltinRuntimeSpecifier = (id: string): boolean =>
	BUILTIN_RUNTIME_PACKAGES.some((packageName) => id === packageName || id.startsWith(packageName + "/"));

export { builtinPolyfills };

/** Options for configuring {@link vitePolyfills}. */
export interface VitePolyfillsOptions {
	/**
	 * The polyfills to detect and inject. Defaults to {@link builtinPolyfills}.
	 *
	 * Pass an explicit array to add custom polyfills, reorder them, or omit
	 * built-ins. An empty array disables every built-in polyfill.
	 * Spread `builtinPolyfills` to extend the default set:
	 *
	 * ```ts
	 * vitePolyfills({ polyfills: [...builtinPolyfills, myCustomPolyfill] });
	 * ```
	 */
	readonly polyfills?: readonly Polyfill[];
}

/**
 * Vite plugin that detects polyfillable language features in transformed
 * source files and prepends imports for matching virtual polyfill modules.
 *
 * @param options - Selects and orders the polyfill definitions to detect.
 * @returns A Vite pre-transform plugin that injects matching runtime imports.
 * @throws {Error} When multiple polyfill definitions have the same identifier.
 *
 * @example
 * ```ts
 * import { defineConfig } from "vite";
 * import { vitePolyfills } from "@serve-tools/vite-polyfills";
 *
 * export default defineConfig({
 *   plugins: [vitePolyfills()],
 * });
 * ```
 */
export function vitePolyfills(options: VitePolyfillsOptions = {}): Plugin {
	const polyfills = options.polyfills ?? builtinPolyfills;
	const codeById = new Map<string, string>(
		polyfills.map((polyfill) => [VIRTUAL_PREFIX + polyfill.id, polyfill.code]),
	);
	const runtimeModuleIds = new Set<string>();

	if (codeById.size !== polyfills.length) {
		throw new Error(`[${PLUGIN_NAME}] duplicate polyfill id`);
	}

	return {
		name: PLUGIN_NAME,
		enforce: "pre",

		resolveId(id, importer) {
			if (codeById.has(id)) {
				return NULL_BYTE + id;
			}

			if (
				!isBuiltinRuntimeSpecifier(id) &&
				(!importer || (!importer.startsWith(NULL_BYTE + VIRTUAL_PREFIX) && !runtimeModuleIds.has(importer)))
			) {
				return null;
			}

			return this.resolve(id, importer, { skipSelf: true }).then((resolved) => {
				if (resolved && !resolved.external) {
					runtimeModuleIds.add(resolved.id);
				}

				return resolved;
			});
		},

		load(id) {
			return id.startsWith(NULL_BYTE) ? (codeById.get(id.slice(1)) ?? null) : null;
		},

		transform: rolldownTransform({
			filter: {
				id: {
					include: /\.[cm]?[jt]sx?(?:\?|$)/,
					exclude: "**/node_modules/**",
				},
			},
			handler(_code, id, meta) {
				if (
					NODE_MODULES_SEGMENT.test(id) ||
					runtimeModuleIds.has(id) ||
					id.startsWith(NULL_BYTE + VIRTUAL_PREFIX)
				) {
					return null;
				}

				let imports = "";

				for (const polyfill of polyfills) {
					let found = false;

					const visitor = polyfill.detect(() => {
						found = true;
					});

					new Visitor(visitor).visit(meta.ast);

					if (found) {
						imports += `import"${VIRTUAL_PREFIX}${polyfill.id}";`;
					}
				}

				if (!imports) {
					return null;
				}

				meta.magicString.prepend(imports);

				return meta.magicString.hasChanged() ? { code: meta.magicString } : null;
			},
		}),
	};
}
