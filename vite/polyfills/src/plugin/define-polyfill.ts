import type { VisitorObject } from "vite";

/**
 * A self-contained polyfill that the plugin can detect and inject.
 *
 * The plugin walks the AST of every transformed module with the visitor
 * returned by `detect`. If a visitor method calls `found()`, the polyfill's
 * `code` is exposed via a virtual module and an import is prepended to the
 * transformed source.
 */
export interface Polyfill {
	/**
	 * Stable identifier used to derive the virtual module specifier.
	 *
	 * Must be a unique, URL-safe, kebab-case slug (e.g. `"symbol-dispose"`).
	 */
	readonly id: string;

	/**
	 * Runtime polyfill source served from the virtual module.
	 *
	 * This code is evaluated for its side effects on first import; it should
	 * be self-guarding (i.e. a no-op when the feature is already available).
	 */
	readonly code: string;

	/**
	 * Builds a Vite OXC visitor that calls `found` when the AST references
	 * the feature this polyfill provides.
	 */
	readonly detect: (found: () => void) => VisitorObject;
}

/**
 * Identity helper that preserves the literal type of a polyfill definition
 * while validating its shape at the use site.
 */
export const definePolyfill = (polyfill: Polyfill): Polyfill => polyfill;
