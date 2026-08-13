import { Signal } from "@serve-tools/signal";
import { createEffect } from "@serve-tools/signal-effect";

import { type Disposer, disown, own } from "./dispose.js";

export const assign = (owner: Node, target: object, values: object): void => {
	for (const name in values) handler((values as any)[name], (value) => ((target as any)[name] = value), owner);
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
	element: T,
	items: ((element: never) => any)[],
	target?: ParentNode,
): T => {
	for (const template of items) {
		template(element as never);
	}

	target?.appendChild(element);

	return element;
};

interface ReadableSignal<T> {
	get(): T;
}

export type Watchable<T> = T | ReadableSignal<T>;
