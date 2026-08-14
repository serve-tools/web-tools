/// <reference lib="esnext.disposable" />

import type * as PublicTypes from "../src/client-messaging.js";
import type { Handlers, MessageEndpoint, ProtocolType, RequestContext } from "../src/client-messaging.js";
import { connect, serve, transfer } from "../src/client-messaging.js";
import type * as Types from "../src/lib/.types.js";
import { connect as connectWindow } from "../src/scope/window.js";
import { listen as listenWorker } from "../src/scope/worker.js";

type ApplicationProtocol = {
	requests: {
		add(input: { a: number; b: number }): number;
		awaited(): Promise<string>;
		buffer(input: ArrayBuffer): ArrayBuffer;
		optional(input: string | undefined): number;
		status(): string;
	};
	subscriptions: {
		optional(input: string | undefined): number;
		progress(input: { job: string }): number;
		raw(): Promise<number>;
		totals(): number;
	};
};

type RequestOnlyProtocol = { requests: { ping(): "pong" } };
type SubscriptionOnlyProtocol = { subscriptions: { tick(): number } };
type EmptyProtocol = Record<never, never>;

export type PublicTypesInTypesModule = [
	Types.Protocol,
	Types.MessageEndpoint,
	Types.RequestOptions,
	Types.SubscribeOptions,
	Types.RequestContext,
	Types.SubscriptionContext<unknown>,
	Types.TransferResult<unknown>,
	Types.Subscription,
	Types.Client<ApplicationProtocol>,
	Types.Server<ApplicationProtocol>,
	Types.ProtocolType<Types.Server<ApplicationProtocol>>,
	Types.ProtocolType<Types.Listener<ApplicationProtocol>>,
	Types.Handlers<ApplicationProtocol>,
	Types.Listener<ApplicationProtocol>,
];

export type RemovedWorkerSymbols = [
	// @ts-expect-error WorkerOperation was removed
	PublicTypes.WorkerOperation,
	// @ts-expect-error WorkerProtocol was removed
	PublicTypes.WorkerProtocol,
	// @ts-expect-error WorkerRequestOptions was removed
	PublicTypes.WorkerRequestOptions,
	// @ts-expect-error WorkerSubscribeOptions was removed
	PublicTypes.WorkerSubscribeOptions,
	// @ts-expect-error WorkerRequestContext was removed
	PublicTypes.WorkerRequestContext,
	// @ts-expect-error WorkerSubscriptionContext was removed
	PublicTypes.WorkerSubscriptionContext<unknown>,
	// @ts-expect-error WorkerTransferResult was removed
	PublicTypes.WorkerTransferResult<unknown>,
	// @ts-expect-error WorkerSubscription was removed
	PublicTypes.WorkerSubscription,
	// @ts-expect-error WorkerClient was removed
	PublicTypes.WorkerClient<ApplicationProtocol>,
	// @ts-expect-error WorkerServer was removed
	PublicTypes.WorkerServer<ApplicationProtocol>,
	// @ts-expect-error WorkerHandlers was removed
	PublicTypes.WorkerHandlers<ApplicationProtocol>,
	// @ts-expect-error WorkerListener was removed
	PublicTypes.WorkerListener<ApplicationProtocol>,
	// @ts-expect-error WorkerRemoteError was removed
	typeof PublicTypes.WorkerRemoteError,
];

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

export type TransferListUsesPlatformType = Expect<
	Equal<NonNullable<Types.RequestOptions["transfer"]>, readonly Transferable[]>
>;
const endpoint = {} as MessageEndpoint;
const client = connect<ApplicationProtocol>(endpoint);
const sum: Promise<number> = client.request("add", { a: 1, b: 2 });
const awaited: Promise<string> = client.request("awaited");
const optional: Promise<number> = client.request("optional", "value");
const optionalUndefined: Promise<number> = client.request("optional", undefined);
const status: Promise<string> = client.request("status");
const totals = client.subscribe("totals", (value) => value.toFixed());
const progress = client.subscribe("progress", { job: "build" }, (value) => value.toFixed());
const optionalSubscription = client.subscribe("optional", "value", (value) => value.toFixed());
const rawSubscription = client.subscribe("raw", (value) => {
	const raw: Promise<number> = value;

	return raw;
});

client.request("buffer", new ArrayBuffer(8));
client.request("buffer", new ArrayBuffer(8), { transfer: [new ArrayBuffer(8)] });

// @ts-expect-error unknown request name
client.request("missing");
// @ts-expect-error wrong request input
client.request("add", { a: "1", b: 2 });
// @ts-expect-error zero-input requests do not accept an input value
client.request("status", "now");
// @ts-expect-error wrong subscription input
client.subscribe("progress", { id: 1 }, () => {});
// @ts-expect-error subscription events are numbers
client.subscribe("totals", (value: string) => value);

const handlers = {
	requests: {
		add: (input, context) => {
			const { a, b }: { a: number; b: number } = input;
			const requestContext: RequestContext = context;

			void requestContext;

			return a + b;
		},
		awaited: () => "ready",
		buffer: (value) => transfer(value, [value]),
		optional: (value) => value?.length ?? 0,
		status: () => "ready",
	},
	subscriptions: {
		optional: (value, { emit }) => emit(value?.length ?? 0),
		progress: (input, context) => {
			const { job }: { job: string } = input;
			const subscriptionContext: Types.SubscriptionContext<number> = context;

			subscriptionContext.emit(job.length);
		},
		raw: (_input, { emit }) => emit(Promise.resolve(1)),
		totals: (_input, { emit }) => {
			emit(1);
			// @ts-expect-error this subscription emits numbers
			emit("one");
		},
	},
} satisfies Handlers<ApplicationProtocol>;

export type HandlerInference = [
	Expect<Equal<Parameters<typeof handlers.requests.add>, [{ a: number; b: number }, RequestContext]>>,
	Expect<
		Equal<Parameters<typeof handlers.subscriptions.progress>, [{ job: string }, Types.SubscriptionContext<number>]>
	>,
];

const server = serve<ApplicationProtocol>(endpoint, handlers);
const connections = listenWorker<ApplicationProtocol>(handlers);
const windowClient = connectWindow<ApplicationProtocol>(endpoint);

const requestOnlyHandlers = { requests: { ping: () => "pong" as const } } satisfies Handlers<RequestOnlyProtocol>;
const subscriptionOnlyHandlers = {
	subscriptions: { tick: (_input, { emit }) => emit(1) },
} satisfies Handlers<SubscriptionOnlyProtocol>;
const emptyHandlers = {} satisfies Handlers<EmptyProtocol>;
const requestOnlyClient = connect<RequestOnlyProtocol>(endpoint);
const subscriptionOnlyClient = connect<SubscriptionOnlyProtocol>(endpoint);
const emptyClient = connect<EmptyProtocol>(endpoint);

requestOnlyClient.request("ping");
subscriptionOnlyClient.subscribe("tick", (value) => value.toFixed());
serve<RequestOnlyProtocol>(endpoint, requestOnlyHandlers);
serve<SubscriptionOnlyProtocol>(endpoint, subscriptionOnlyHandlers);
serve<EmptyProtocol>(endpoint, emptyHandlers);

// @ts-expect-error request-only protocols have no subscriptions
requestOnlyClient.subscribe("tick", () => {});
// @ts-expect-error subscription-only protocols have no requests
subscriptionOnlyClient.request("ping");
// @ts-expect-error empty protocols have no requests
emptyClient.request("ping");

// @ts-expect-error operations accept zero or one input
connect<{ requests: { invalid(first: string, second: number): void } }>(endpoint);

connections.close();

export type ProtocolTypeIsPreserved = [
	Expect<Equal<ProtocolType<typeof client>, ApplicationProtocol>>,
	Expect<Equal<ProtocolType<typeof server>, ApplicationProtocol>>,
	Expect<Equal<ProtocolType<typeof connections>, ApplicationProtocol>>,
	Expect<Equal<connect.ProtocolType<typeof client>, ApplicationProtocol>>,
	Expect<Equal<serve.ProtocolType<typeof server>, ApplicationProtocol>>,
	Expect<Equal<connectWindow.ProtocolType<typeof windowClient>, ApplicationProtocol>>,
	Expect<Equal<listenWorker.ProtocolType<typeof connections>, ApplicationProtocol>>,
];

export type UnbrandedProtocolTypeIsNever = Expect<Equal<ProtocolType<Record<never, never>>, never>>;

declare const messagePort: MessagePort;
declare const dedicatedWorker: Worker;
declare const dedicatedWorkerScope: DedicatedWorkerGlobalScope;

connect<ApplicationProtocol>(messagePort);
connect<ApplicationProtocol>(dedicatedWorker);
serve<ApplicationProtocol>(dedicatedWorkerScope, handlers);

void sum;
void awaited;
void optional;
void optionalUndefined;
void status;
void totals;
void progress;
void optionalSubscription;
void rawSubscription;
