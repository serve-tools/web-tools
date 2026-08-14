import type { Watchable } from "./.internals.js";
import { assign } from "./.internals.js";

/** Assigns properties to an element. */
export const props =
	<T extends DOM.Element = DOM.Element>(userProps: props.PropertySet<T>): props.Template<T> =>
	(element) => (assign(element, element, userProps), element);

/** Types used by {@link props}. */
export namespace props {
	/** A template that assigns properties and returns the same element. */
	export type Template<T extends DOM.Element = DOM.Element> = (element: T) => T;

	/** Static or signal-backed writable properties accepted for an element. */
	export type PropertySet<T extends DOM.Element = DOM.Element> = {
		[K in keyof DOM.PropertySet<T>]: Watchable<DOM.PropertySet<T>[K]>;
	};
}
