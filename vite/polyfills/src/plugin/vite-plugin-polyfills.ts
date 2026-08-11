import { rolldownTransform } from "@jsxtools/rolldown-transform";
import { type Plugin, Visitor } from "vite";
import type { Polyfill } from "./define-polyfill.js";

const PLUGIN_NAME = "vite-plugin-polyfills";
const VIRTUAL_PREFIX = "virtual:@serve-tools/vite-polyfill/";
const NULL_BYTE = "\0";

/** Polyfills bundled with the plugin and enabled by default. */
export const builtinPolyfills: readonly Polyfill[] = await Promise.all([
	import("../polyfills/symbol-dispose-polyfill.js"),
	import("../polyfills/symbol-async-dispose-polyfill.js"),
	import("../polyfills/disposable-stack-polyfill.js"),
	import("../polyfills/async-disposable-stack-polyfill.js"),
	import("../polyfills/suppressed-error-polyfill.js"),
	import("../polyfills/url-pattern-polyfill.js"),
	import("../polyfills/map-upsert-polyfill.js"),
	import("../polyfills/request-idle-callback-polyfill.js"),
	import("../polyfills/cancel-idle-callback-polyfill.js"),
]).then((modules) => modules.map((module) => module.default));

export interface VitePolyfillsOptions {
	/**
	 * The polyfills to detect and inject. Defaults to {@link builtinPolyfills}.
	 *
	 * Pass an explicit array to add custom polyfills, reorder them, or omit
	 * built-ins. Spread `builtinPolyfills` to extend the default set:
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

	if (codeById.size !== polyfills.length) {
		throw new Error(`[${PLUGIN_NAME}] duplicate polyfill id`);
	}

	return {
		name: PLUGIN_NAME,
		enforce: "pre",

		resolveId(id) {
			return codeById.has(id) ? NULL_BYTE + id : null;
		},

		load(id) {
			return id.startsWith(NULL_BYTE) ? (codeById.get(id.slice(1)) ?? null) : null;
		},

		transform: rolldownTransform({
			filter: {
				id: {
					include: /\.[cm]?[jt]sx?(?:\?|$)/,
					exclude: "node_modules",
				},
			},
			handler(_code, id, meta) {
				if (id.startsWith(NULL_BYTE + VIRTUAL_PREFIX)) {
					return null;
				}

				const matched: Polyfill[] = [];

				for (const polyfill of polyfills) {
					let found = false;

					const visitor = polyfill.detect(() => {
						found = true;
					});

					new Visitor(visitor).visit(meta.ast);

					if (found) {
						matched.push(polyfill);
					}
				}

				if (matched.length === 0) {
					return null;
				}

				meta.magicString.prepend(
					matched.map((polyfill) => `import"${VIRTUAL_PREFIX}${polyfill.id}";`).join(""),
				);

				return meta.magicString.hasChanged() ? { code: meta.magicString } : null;
			},
		}),
	};
}
