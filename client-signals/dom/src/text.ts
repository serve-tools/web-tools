import type { Watchable } from "./.internals.js";
import { handler } from "./.internals.js";

/** Creates a text node with the specified content. */
export const text =
	<P extends ParentNode = ParentNode>(content: Watchable<string | number | boolean>): text.Template<P> =>
	(parent?: ParentNode) => {
		const text = new Text("");

		handler(content, (value) => (text.data = String(value ?? "")), text);

		parent?.appendChild(text);

		return text;
	};

/** Types used by {@link text}. */
export namespace text {
	/** A template that creates a text node and optionally appends it to a parent. */
	export type Template<P extends ParentNode = ParentNode> = (parent?: P) => Text;
}
