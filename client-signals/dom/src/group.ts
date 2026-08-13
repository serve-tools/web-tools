import { handler, type Watchable } from "./.internals.js";
import { type Disposer, disown, dispose, own } from "./dispose.js";

/** Conditionally presents a persistent group of nodes. */
export const group =
	(condition: Watchable<boolean>, ...templates: group.Item[]): group.Template =>
	(parent) => {
		const placeholder = new Text("");
		const nodes = templates.flatMap((template) => template(placeholder.parentNode as never));

		if (!nodes.length) {
			nodes.push(placeholder);
		}

		let disposed = false;
		let hasRendered = false;
		let conditionCleanup: Disposer | undefined;
		let range: Range | undefined;

		const cleanup: Disposer = () => {
			if (disposed) {
				return;
			}

			disposed = true;

			conditionCleanup?.();

			disown(placeholder, cleanup);

			for (const node of nodes) {
				disown(node, cleanup);
			}

			for (const node of nodes) {
				dispose(node);
			}
		};

		own(placeholder, cleanup);

		for (const node of nodes) {
			if (node !== placeholder) {
				own(node, cleanup);
			}
		}

		conditionCleanup = handler(condition, (shouldRender) => {
			if (disposed) {
				return;
			}

			if (shouldRender) {
				if (hasRendered) {
					placeholder.replaceWith(...nodes);
				} else {
					parent?.append(...nodes);

					hasRendered = true;
				}
			} else {
				if (hasRendered) {
					range ??= new Range();

					range.setStartBefore(nodes[0]);
					range.setEndAfter(nodes[nodes.length - 1]);
					range.deleteContents();

					range.insertNode(placeholder);
				} else {
					parent?.append(placeholder);

					hasRendered = true;
				}
			}
		});

		if (disposed) {
			conditionCleanup?.();
		}

		return placeholder;
	};

/** Types used by {@link group}. */
export namespace group {
	/** A template that creates one node or a persistent region of nodes. */
	export type Item = (parent?: ParentNode) => Node | Node[];

	/** A conditional-region template whose returned text node identifies the region. */
	export type Template = (parent?: ParentNode) => Text;
}
