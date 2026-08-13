import { assign, type Watchable } from "./.internals.js";
import type { DOM } from "./types.js";

/** Attaches element internals and reactively assigns writable properties. */
export const elementInternals =
	<T extends DOM.HTML.Element = DOM.HTML.Element>(
		values: elementInternals.InternalsSet,
	): elementInternals.Template<T> =>
	(element) => (assign(element, element.attachInternals(), values), element);

/** Types used by {@link elementInternals}. */
export namespace elementInternals {
	/** A template that attaches element internals and returns the same element. */
	export type Template<T extends DOM.HTML.Element = DOM.HTML.Element> = (element: T) => T;

	/** Static or signal-backed writable `ElementInternals` properties. */
	export type InternalsSet = {
		[K in keyof DOM.HTML.Element.InternalsMap]: Watchable<DOM.HTML.Element.InternalsMap[K]>;
	};
}
