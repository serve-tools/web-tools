/// <reference lib="esnext.disposable" preserve="true" />

import type { Client, Protocol, RequestOptions, SubscribeOptions, Subscription } from "@serve-tools/client-messaging";
import { Signal } from "@serve-tools/signal";

export * from "@serve-tools/client-messaging";

const pending = { status: "pending" } as const;
const complete = { status: "complete" } as const;

const noop = (): void => {};

type Subscribe<Value> = {
	call(
		client: Client<Protocol>,
		name: string,
		onValue: (value: Value) => void,
		options: SubscribeOptions,
	): Subscription;
	call(
		client: Client<Protocol>,
		name: string,
		input: unknown,
		onValue: (value: Value) => void,
		options: SubscribeOptions,
	): Subscription;
};

class ReactiveObservation<Value> extends Signal.Computed<ObservationState<Value>> implements Disposable {
	#off = noop;
	#subscription: Subscription | undefined;

	constructor(
		client: Client<Protocol>,
		name: string,
		options: (ObserveOptions & { readonly input?: unknown }) | undefined,
	) {
		const state = new Signal.State<ObservationState<Value>>(pending);

		super(() => state.get());

		let settled = false;
		let off = noop;

		const settle = (next: ObservationState<Value>): void => {
			if (settled) {
				return;
			}

			settled = true;
			off();
			state.set(next);
		};

		const signal = options?.signal;

		if (signal !== undefined) {
			const abort = (): void => settle({ status: "error", error: signal.reason });

			off = (): void => signal.removeEventListener("abort", abort);
			this.#off = off;

			if (signal.aborted) {
				abort();

				return;
			}

			signal.addEventListener("abort", abort, { once: true });
		}

		try {
			const subscribe = client.subscribe as unknown as Subscribe<Value>;
			const onValue = (value: Value) => {
				if (!settled) {
					state.set({ status: "ready", value });
				}
			};

			const subscriptionOptions = {
				...(signal === undefined ? {} : { signal }),
				...(options?.transfer === undefined ? {} : { transfer: options.transfer }),
				onComplete: () => settle(complete),
				onError: (error: Error) => settle({ status: "error", error }),
			};

			const subscription =
				options && "input" in options
					? subscribe.call(client, name, options.input, onValue, subscriptionOptions)
					: subscribe.call(client, name, onValue, subscriptionOptions);

			this.#subscription = subscription;

			if (settled) {
				subscription.unsubscribe();
			}
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

		if (subscription === undefined) {
			return;
		}

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
export const observe = <const P extends Protocol, const Name extends SubscriptionName<P>>(
	client: Client<P>,
	name: Name,
	...arguments_: ObserveArguments<SubscriptionOperation<P, Name>>
): Observation<ReturnType<SubscriptionOperation<P, Name>>> => {
	type Value = ReturnType<SubscriptionOperation<P, Name>>;

	const options = arguments_[0] as (ObserveOptions & { readonly input?: unknown }) | undefined;

	return new ReactiveObservation<Value>(client, name, options);
};

/** The current state of a messaging subscription observed as a Signal. */
export type ObservationState<Value> =
	| {
			/** Identifies an observation waiting for its first value or terminal outcome. */
			readonly status: "pending";
	  }
	| {
			/** Identifies an observation containing its latest emitted value. */
			readonly status: "ready";

			/** The latest value emitted by the subscription. */
			readonly value: Value;
	  }
	| {
			/** Identifies a subscription that completed normally. */
			readonly status: "complete";
	  }
	| {
			/** Identifies a subscription that failed or was cancelled. */
			readonly status: "error";

			/** The remote, setup, or cancellation failure. */
			readonly error: unknown;
	  };

/** A read-only messaging subscription Signal with an explicit observation lifecycle. */
export type Observation<Value> = InstanceType<typeof Signal.Computed<ObservationState<Value>>> &
	Disposable & {
		/** Whether the underlying messaging subscription can still emit values. */
		readonly active: boolean;

		/** Unsubscribes once and freezes the current observation state. */
		dispose(): void;
	};

/** Cancellation and transfer options for an observed messaging subscription. */
export type ObserveOptions = RequestOptions;

type Operation = (...arguments_: any[]) => unknown;
type Subscriptions<P extends Protocol> = P extends { readonly subscriptions: infer Operations }
	? Operations
	: Record<never, never>;
type SubscriptionName<P extends Protocol> = Extract<keyof Subscriptions<P>, string>;
type SubscriptionOperation<P extends Protocol, Name extends SubscriptionName<P>> = Extract<
	Subscriptions<P>[Name],
	Operation
>;
type NoInput = ReturnType<() => void>;
type OperationInput<Value extends Operation> = Parameters<Value> extends [] ? NoInput : Parameters<Value>[0];
type ObserveArguments<Value extends Operation> = [OperationInput<Value>] extends [NoInput]
	? [options?: ObserveOptions]
	: [options: ObserveOptions & { readonly input: OperationInput<Value> }];
