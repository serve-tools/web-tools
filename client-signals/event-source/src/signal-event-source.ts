/// <reference lib="esnext.disposable" />

import type {
	EventClient,
	EventMap,
	EventMessage,
	JSONValue,
	SubscribeOptions,
	Subscription,
} from "@serve-tools/client-event-source";
import { Signal } from "@serve-tools/signal";

const pending = { status: "pending" } as const;

type UntypedEventClient = {
	subscribe(
		name: string,
		listener: (event: EventMessage<JSONValue>) => void,
		options?: SubscribeOptions,
	): Subscription;
};

class ReactiveEvent<Value extends JSONValue> extends Signal.Computed<ObservationState<Value>> implements Disposable {
	#subscription: Subscription | undefined;

	constructor(client: UntypedEventClient, name: string, options?: ObserveOptions) {
		const state = new Signal.State<ObservationState<Value>>(pending);

		super(() => state.get());

		this.#subscription = client.subscribe(
			name,
			(event) => state.set({ status: "ready", event: event as EventMessage<Value> }),
			options,
		);
	}

	/** Whether this Signal is still observing its event subscription. */
	get active(): boolean {
		return this.#subscription?.active ?? false;
	}

	/** Unsubscribes once and freezes the current observation state. */
	dispose(): void {
		this.#subscription?.unsubscribe();
		this.#subscription = undefined;
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}

/** Eagerly observes the latest typed JSON event, including its EventSource ID, as a read-only Signal. */
export const observe = <const Events extends EventMap, const Name extends Extract<keyof Events, string>>(
	client: EventClient<Events>,
	name: Name,
	options?: ObserveOptions,
): Observation<Extract<Events[Name], JSONValue>> =>
	new ReactiveEvent(client as unknown as UntypedEventClient, name, options);

/** The current state of an observed EventSource event. */
export type ObservationState<Value extends JSONValue> =
	| { readonly status: "pending" }
	| { readonly status: "ready"; readonly event: EventMessage<Value> };

/** A read-only Signal containing the latest typed EventSource event and ID. */
export type Observation<Value extends JSONValue> = InstanceType<typeof Signal.Computed<ObservationState<Value>>> &
	Disposable & {
		readonly active: boolean;
		dispose(): void;
	};

/** Cancellation options for an observed EventSource event. */
export type ObserveOptions = SubscribeOptions;

export * from "@serve-tools/client-event-source";
