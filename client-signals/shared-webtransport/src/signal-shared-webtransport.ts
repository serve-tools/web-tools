import type {
	Protocol,
	RequestOptions,
	SharedWebTransportClient,
} from "@serve-tools/client-shared-webtransport/scope/window";
import type { Observation } from "@serve-tools/signal-messaging";
import { observe as observeMessaging } from "@serve-tools/signal-messaging";

export type {
	Protocol,
	ProtocolType,
	SharedWebTransportClient,
	SubscribeOptions,
	Subscription,
} from "@serve-tools/client-shared-webtransport/scope/window";
export type { Observation, ObservationState } from "@serve-tools/signal-messaging";

export const observe = observeMessaging as unknown as Observe;
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
	client: SharedWebTransportClient<P>,
	name: Name,
	...arguments_: ObserveArguments<SubscriptionOperation<P, Name>>
) => Observation<ReturnType<SubscriptionOperation<P, Name>>>;
