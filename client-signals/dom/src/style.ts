import { Signal } from "@serve-tools/signal";

import { handler, isSignal, type Watchable } from "./.internals.js";
import { dispose, own } from "./dispose.js";
import type { DOM } from "./types.js";

/** Creates a constructed stylesheet from a static or signal-derived CSS template. */
export const css = (strings: TemplateStringsArray, ...values: Array<Watchable<CSSValue>>): CSSStyleSheet => {
	const sheet = new CSSStyleSheet();
	const serializeTemplate = () => {
		let cssText = strings.raw[0];

		for (let index = 0; index < values.length; ++index) {
			const value = values[index];

			cssText += serialize(isSignal(value) ? value.get() : value) + strings.raw[index + 1];
		}

		return cssText;
	};

	if (values.some(isSignal)) {
		handler(new Signal.Computed(serializeTemplate), (value) => sheet.replaceSync(value), sheet);
	} else {
		sheet.replaceSync(serializeTemplate());
	}

	return sheet;
};

/** Adopts a constructed stylesheet. */
export const adoptedCSS =
	<T extends DOM.Root = DOM.Root>(sheet: CSSStyleSheet): adoptedCSS.Template<T> =>
	(root) => {
		own(root, () => dispose(sheet));

		root.adoptedStyleSheets.push(sheet);

		return root;
	};

/** Types used by {@link adoptedCSS}. */
export namespace adoptedCSS {
	/** A template that adopts a stylesheet into a document or shadow root. */
	export type Template<T extends DOM.Root = DOM.Root> = (root: T) => T;
}

const isInstance = <T>(value: unknown, constructor: { prototype: T } | undefined): value is T =>
	constructor !== undefined &&
	value !== null &&
	typeof value === "object" &&
	Object.prototype.isPrototypeOf.call(constructor.prototype, value);

const serialize = (value: CSSValue): string => {
	if (value === null || value === undefined) return "";
	if (typeof value !== "object") return String(value);

	return isInstance(value, globalThis.CSSStyleSheet)
		? serializeRuleList(value.cssRules)
		: isInstance(value, globalThis.CSSRuleList)
			? serializeRuleList(value)
			: isInstance(value, globalThis.CSSRule) || isInstance(value, globalThis.CSSStyleDeclaration)
				? value.cssText
				: String(value);
};

const serializeRuleList = (list: CSSRuleList): string => Array.from(list, (rule) => rule.cssText).join("\n");

/** A value accepted in a {@link css} template interpolation. */
export type CSSValue =
	| string
	| number
	| boolean
	| CSSRule
	| CSSRuleList
	| CSSStyleDeclaration
	| CSSStyleSheet
	| CSSStyleValue
	| null
	| undefined;
