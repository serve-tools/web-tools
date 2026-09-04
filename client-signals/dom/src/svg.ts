import { render } from "./.internals.js";
import type { html } from "./html.js";

/** Creates an SVG element with the specified tag name and applies the given items to it. */
export const svg =
	<K extends DOM.SVG.Element.Name>(name: K, ...items: svg.Item<K>[]): svg.Template<DOM.SVG.ElementMap[K]> =>
	(target) =>
		render<DOM.SVG.ElementMap[K]>(name, items as never, target, "http://www.w3.org/2000/svg");

/** Types used by {@link svg}. */
export namespace svg {
	/** A template that creates an SVG element and optionally appends it to a parent. */
	export type Template<T extends DOM.SVG.Element = DOM.SVG.Element, P extends ParentNode = ParentNode> = (
		parent?: P,
	) => T;

	/** A child template or element modifier accepted by an SVG template. */
	export type Item<K extends DOM.SVG.Element.Name = DOM.SVG.Element.Name> =
		| Template<DOM.SVG.ElementMap[K]>
		| ((element: DOM.SVG.ElementMap[K]) => any)
		| html.Template<DOM.HTML.Element, DOM.SVG.ElementMap[K]>;
}
