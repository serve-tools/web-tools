/// <reference lib="esnext.disposable" preserve="true" />

import type { OperationView } from "@serve-tools/async-operation";
import { AsyncOperation, AsyncOperationSubscriber } from "@serve-tools/async-operation";
import { Signal } from "@serve-tools/signal";

export { AsyncOperation, AsyncOperationSubscriber, type OperationView };

/** A disposable read-only Signal retaining the latest value emitted by one OperationView. */
export interface OperationViewSignal<T> extends Signal.Computed<T>, Disposable {
	/** Whether this Signal still observes its view. */
	readonly active: boolean;

	/** Stops observing the view and retains its current value. */
	dispose(): void;
}

class OperationViewSignalImplementation<T, TInitial>
	extends Signal.Computed<T | TInitial>
	implements OperationViewSignal<T | TInitial>
{
	constructor(view: OperationView<T>, initialValue: TInitial) {
		const state = new Signal.State<T | TInitial>(initialValue);

		super(() => state.get());

		this.#subscription = view.subscribe((value) => {
			state.set(value);
		});
	}

	/** Whether this Signal still observes its view. */
	get active(): boolean {
		return this.#subscription !== undefined;
	}

	/** Stops observing the view and retains its current value. */
	dispose(): void {
		this.#subscription?.[Symbol.dispose]();
		this.#subscription = undefined;
	}

	[Symbol.dispose](): void {
		this.dispose();
	}

	#subscription: Disposable | undefined;
}

/** Creates a read-only Signal retaining the latest value from one OperationView. */
export function observeOperationView<T>(view: OperationView<T>): OperationViewSignal<T | undefined>;

/** Creates a read-only Signal with an initial value until its OperationView emits. */
export function observeOperationView<T, TInitial>(
	view: OperationView<T>,
	initialValue: TInitial,
): OperationViewSignal<T | TInitial>;

export function observeOperationView<T, TInitial>(
	view: OperationView<T>,
	initialValue?: TInitial,
): OperationViewSignal<T | TInitial | undefined> {
	return new OperationViewSignalImplementation(view, initialValue);
}
