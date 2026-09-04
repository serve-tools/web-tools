import type { Watchable } from "./_internals.js";
import { getDocument, handler } from "./_internals.js";

/** Creates a text node with the specified content. */
export const text =
	<P extends ParentNode = ParentNode>(content: Watchable<string | number | boolean>): text.Template<P> =>
	(parent?: ParentNode) => {
		const text = getDocument(parent).createTextNode("");

		handler(content, (value) => (text.data = String(value ?? "")), text);

		parent?.appendChild(text);

		return text;
	};

/** Types used by {@link text}. */
export namespace text {
	/** A template that creates a text node and optionally appends it to a parent. */
	export type Template<P extends ParentNode = ParentNode> = (parent?: P) => Text;
}
