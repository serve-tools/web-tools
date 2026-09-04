import { Signal } from "@serve-tools/signal";
import { createEffect } from "@serve-tools/signal-effect";
import type { Disposer } from "./dispose.js";
import { disown, own } from "./dispose.js";
import { captureBinding, isCapturingBindings } from "./scope.js";

let currentDocument: Document | undefined;

export const assign = (owner: Node, target: object, values: object): void => {
	for (const name in values) {
		handler((values as any)[name], (value) => ((target as any)[name] = value), owner);
	}
};

export const isSignal = <T>(value: Watchable<T>): value is ReadableSignal<T> =>
	Signal.isState(value) || Signal.isComputed(value);

export const handler = <T>(
	value: T,
	setter: (value: T extends ReadableSignal<infer U> ? U : T) => any,
	owner?: object,
): Disposer | undefined => {
	if (isSignal(value)) {
		const signal = value as ReadableSignal<unknown>;

		if (isCapturingBindings()) {
			const scopedBinding = captureBinding(owner, () => setter(signal.get() as never))!;

			try {
				Signal.subtle.untrack(scopedBinding.run);
			} catch (error) {
				scopedBinding.dispose();

				throw error;
			}

			return scopedBinding.dispose;
		}

		const effect = createEffect(() => setter(signal.get() as never));

		const cleanup = () => {
			effect.dispose();

			if (owner) {
				disown(owner, cleanup);
			}
		};

		if (owner) {
			own(owner, cleanup);
		}

		try {
			effect.start();
		} catch (error) {
			if (owner) {
				disown(owner, cleanup);
			}

			throw error;
		}

		return cleanup;
	}

	setter(value as never);
};

export const render = <T extends DOM.Element>(
	name: string,
	items: ((element: never) => any)[],
	target?: ParentNode,
	namespace?: string,
): T => {
	const ownerDocument = getDocument(target);
	const previousDocument = currentDocument;

	currentDocument = ownerDocument;

	try {
		const element = (
			namespace ? ownerDocument.createElementNS(namespace, name) : ownerDocument.createElement(name)
		) as T;

		for (const template of items) {
			template(element as never);
		}

		target?.appendChild(element);

		return element;
	} finally {
		currentDocument = previousDocument;
	}
};

export const getDocument = (target?: ParentNode): Document =>
	target
		? target.nodeType === 9
			? (target as Document)
			: (target.ownerDocument ?? currentDocument ?? document)
		: (currentDocument ?? document);

export const getCurrentDocument = (): Document | undefined => currentDocument;

export const withDocument = <T>(ownerDocument: Document, callback: () => T): T => {
	const previousDocument = currentDocument;

	currentDocument = ownerDocument;

	try {
		return callback();
	} finally {
		currentDocument = previousDocument;
	}
};

interface ReadableSignal<T> {
	get(): T;
}

export type Watchable<T> = T | ReadableSignal<T>;
