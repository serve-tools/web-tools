import type { Client, Protocol, RequestOptions } from "@serve-tools/client-http-stream";
import type { Observation } from "@serve-tools/signal-messaging";
import { observe as observeMessaging } from "@serve-tools/signal-messaging";

export * from "@serve-tools/client-http-stream";
export type { Observation, ObservationState } from "@serve-tools/signal-messaging";

/** Eagerly observes one typed HTTP streaming subscription as a read-only Signal. */
export const observe = observeMessaging as unknown as Observe;

/** Cancellation options for an observed HTTP streaming subscription. */
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

type Observe = <const P extends Protocol, const Name extends SubscriptionName<P>>(
	client: Client<P>,
	name: Name,
	...arguments_: ObserveArguments<SubscriptionOperation<P, Name>>
) => Observation<ReturnType<SubscriptionOperation<P, Name>>>;
