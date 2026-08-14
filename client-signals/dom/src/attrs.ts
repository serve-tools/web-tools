import type { Watchable } from "./.internals.js";
import { handler } from "./.internals.js";

/** Sets attributes on an element. */
export const attrs =
	<T extends DOM.Element = DOM.Element>(userAttrs: attrs.AttributeSet<T>): attrs.Template<T> =>
	(element) => {
		for (const attrName in userAttrs) {
			const attrValue = userAttrs[attrName as keyof typeof userAttrs] as unknown;

			handler(
				attrValue,
				(value) =>
					value === null
						? element.removeAttribute(attrName)
						: element.setAttribute(attrName, value as string),
				element,
			);
		}

		return element;
	};

/** Types used by {@link attrs}. */
export namespace attrs {
	/** A template that assigns attributes and returns the same element. */
	export type Template<T extends DOM.Element = DOM.Element> = (element: T) => T;

	/** Static or signal-backed attributes accepted for an element. */
	export type AttributeSet<T extends DOM.Element = DOM.Element> = {
		[K in keyof DOM.AttributeSet<T>]: Watchable<DOM.AttributeSet<T>[K]>;
	};
}
