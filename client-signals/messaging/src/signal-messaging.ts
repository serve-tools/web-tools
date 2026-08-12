/// <reference lib="esnext.disposable" preserve="true" />

import type {
	WorkerClient,
	WorkerOperation,
	WorkerProtocol,
	WorkerRequestOptions,
	WorkerSubscribeOptions,
	WorkerSubscription,
} from "@serve-tools/client-messaging";
import { Signal } from "@serve-tools/signal";

const pending = { status: "pending" } as const;
const complete = { status: "complete" } as const;

type Start<Value> = (
	onValue: (value: Value) => void,
	onComplete: () => void,
	onError: (error: Error) => void,
) => WorkerSubscription;

class ReactiveObservation<Value> extends Signal.Computed<ObservationState<Value>> implements Disposable {
	#off = () => {};
	#subscription: WorkerSubscription | undefined;

	constructor(start: Start<Value>, signal?: AbortSignal) {
		const state = new Signal.State<ObservationState<Value>>(pending);

		super(() => state.get());

		let settled = false;
		const off = (): void => signal?.removeEventListener("abort", abort);
		const settle = (next: ObservationState<Value>): void => {
			if (settled) return;

			settled = true;
			off();
			state.set(next);
		};
		const abort = (): void => settle({ status: "error", error: signal?.reason });

		this.#off = off;

		if (signal?.aborted) {
			abort();

			return;
		}

		signal?.addEventListener("abort", abort, { once: true });

		try {
			const subscription = start(
				(value) => {
					if (!settled) state.set({ status: "ready", value });
				},
				() => settle(complete),
				(error) => settle({ status: "error", error }),
			);

			this.#subscription = subscription;

			if (settled) subscription.unsubscribe();
		} catch (error) {
			settle({ status: "error", error });
		}
	}

	/** Whether the underlying messaging subscription can still emit values. */
	get active(): boolean {
		return this.#subscription?.active ?? false;
	}

	/** Unsubscribes once and freezes the current observation state. */
	dispose(): void {
		const subscription = this.#subscription;

		if (subscription === undefined) return;

		this.#subscription = undefined;
		this.#off();
		subscription.unsubscribe();
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}

/**
 * Eagerly observes one typed messaging subscription as a read-only Signal.
 *
 * Signal consumers may coalesce intermediate values. Use the underlying client's `subscribe()` when every occurrence
 * must be processed.
 */
export const observe = <const P extends WorkerProtocol, const Name extends SubscriptionName<P>>(
	client: WorkerClient<P>,
	name: Name,
	...arguments_: ObserveArguments<P["subscriptions"][Name]>
): Observation<OutputOf<P["subscriptions"][Name]>> => {
	type Value = OutputOf<P["subscriptions"][Name]>;
	type Subscribe = {
		(name: string, onValue: (value: Value) => void, options: WorkerSubscribeOptions): WorkerSubscription;
		(
			name: string,
			input: unknown,
			onValue: (value: Value) => void,
			options: WorkerSubscribeOptions,
		): WorkerSubscription;
	};

	const options = arguments_[0] as (ObserveOptions & { readonly input?: unknown }) | undefined;
	const subscribe = client.subscribe.bind(client) as unknown as Subscribe;

	return new ReactiveObservation<Value>((onValue, onComplete, onError) => {
		const subscriptionOptions = {
			...(options?.signal === undefined ? {} : { signal: options.signal }),
			...(options?.transfer === undefined ? {} : { transfer: options.transfer }),
			onComplete,
			onError,
		};

		return options && "input" in options
			? subscribe(name, options.input, onValue, subscriptionOptions)
			: subscribe(name, onValue, subscriptionOptions);
	}, options?.signal);
};

/** The current state of a messaging subscription observed as a Signal. */
export type ObservationState<Value> =
	| { readonly status: "pending" }
	| { readonly status: "ready"; readonly value: Value }
	| { readonly status: "complete" }
	| { readonly status: "error"; readonly error: unknown };

/** A read-only messaging subscription Signal with an explicit observation lifecycle. */
export type Observation<Value> = InstanceType<typeof Signal.Computed<ObservationState<Value>>> &
	Disposable & {
		/** Whether the underlying messaging subscription can still emit values. */
		readonly active: boolean;

		/** Unsubscribes once and freezes the current observation state. */
		dispose(): void;
	};

/** Cancellation and transfer options for an observed messaging subscription. */
export type ObserveOptions = WorkerRequestOptions;

type InputOf<Value> = Value extends WorkerOperation<infer Input, unknown> ? Input : never;
type OutputOf<Value> = Value extends WorkerOperation<unknown, infer Output> ? Output : never;
type SubscriptionName<P extends WorkerProtocol> = Extract<keyof P["subscriptions"], string>;
type NoInput = ReturnType<() => void>;
type ObserveArguments<Value> = [InputOf<Value>] extends [NoInput]
	? [options?: ObserveOptions]
	: [options: ObserveOptions & { readonly input: InputOf<Value> }];
