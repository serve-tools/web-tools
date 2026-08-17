/// <reference lib="esnext.disposable" />

/** A value represented without loss by JSON. */
export type JSONValue = null | boolean | number | string | readonly JSONValue[] | { readonly [key: string]: JSONValue };

/** A compile-time map from Server-Sent Event names to JSON values. */
export type EventMap = object;

/** Declaration-only key retaining an event map across compatible client adapters. */
export declare const eventMapBrand: unique symbol;

/** Verifies that every event value is recursively JSON-compatible. */
export type EventMapDefinition<Events> = {
	readonly [Name in keyof Events]: Events[Name] extends JSONDefinition<Events[Name]> ? Events[Name] : never;
};

/** A parsed Server-Sent Event with its spec event ID and origin. */
export interface EventMessage<Value extends JSONValue = JSONValue> {
	readonly type: string;
	readonly data: Value;
	readonly lastEventId: string;
	readonly origin: string;
}

/** Options for opening a native `EventSource`. */
export interface ConnectOptions extends EventSourceInit {
	/** Closes the EventSource when aborted. */
	readonly signal?: AbortSignal;
}

/** Cancellation options for one named event subscription. */
export interface SubscribeOptions {
	readonly signal?: AbortSignal;
}

/** A disposable handle for one active event subscription. */
export interface Subscription extends Disposable {
	readonly active: boolean;
	unsubscribe(): void;
}

/** The typed named-event surface shared by direct and worker-owned EventSource clients. */
export interface EventClient<Events extends EventMap = EventMap> {
	readonly [eventMapBrand]?: Events;
	subscribe<Name extends Extract<keyof Events, string>>(
		name: Name,
		listener: (event: EventMessage<Extract<Events[Name], JSONValue>>) => void,
		options?: SubscribeOptions,
	): Subscription;
}

/** A typed JSON view over a native `EventSource`. */
export interface Client<Events extends EventMap = EventMap> extends EventClient<Events>, Disposable {
	readonly source: EventSource;
	readonly closed: Promise<void>;
	close(): void;
}

/** Extracts the event map retained by an EventSource client. */
export type EventMapType<Value> = Value extends Client<infer Events> ? Events : never;

type JSONPrimitive = null | boolean | number | string;
type JSONDefinition<Value> = Value extends JSONPrimitive
	? Value
	: Value extends (...arguments_: any[]) => unknown
		? never
		: Value extends readonly (infer Item)[]
			? readonly JSONDefinition<Item>[]
			: Value extends object
				? { readonly [Key in keyof Value]: JSONDefinition<Value[Key]> }
				: never;
