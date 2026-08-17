/// <reference lib="esnext.disposable" />

import type {
	ConnectOptions,
	EventMapType as DirectEventMapType,
	EventClient,
	EventMap,
	EventMessage,
	Client as EventSourceClient,
	JSONValue,
} from "@serve-tools/client-event-source";
import type { SubscribeOptions, Subscription } from "@serve-tools/client-messaging";

declare const clientBrand: unique symbol;
declare const serverBrand: unique symbol;

export type { ConnectOptions, EventClient, EventMap, EventMessage, JSONValue, SubscribeOptions, Subscription };

/** A typed EventSource client whose physical connection is owned by a `SharedWorker`. */
export interface SharedEventSourceClient<Events extends EventMap = EventMap> extends EventClient<Events>, Disposable {
	readonly [clientBrand]?: Events;
	readonly closed: Promise<void>;
	subscribe<Name extends Extract<keyof Events, string>>(
		name: Name,
		listener: (event: EventMessage<Extract<Events[Name], JSONValue>>) => void,
		options?: SubscribeOptions,
	): Subscription;
	close(reason?: unknown): void;
}

/** Owns one native EventSource and every page client connected to the current `SharedWorker`. */
export interface SharedEventSourceServer<Events extends EventMap = EventMap> extends Disposable {
	readonly [serverBrand]?: Events;
	readonly eventSource: EventSourceClient<Events>;
	readonly closed: Promise<void>;
	close(reason?: unknown): void;
}

/** Extracts the event map retained by a shared client, server, or direct EventSource client. */
export type EventMapType<Value> =
	| DirectEventMapType<Value>
	| (Value extends SharedEventSourceClient<infer Events> | SharedEventSourceServer<infer Events> ? Events : never);

export type EventMapDefinition<Events> = import("@serve-tools/client-event-source").EventMapDefinition<Events>;

export type BridgeProtocol = {
	subscriptions: {
		event(input: { readonly name: string }): EventMessage;
	};
};
