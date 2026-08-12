/// <reference lib="esnext.disposable" />

import {
	connect,
	type MessageEndpoint,
	type ProtocolType,
	serve,
	transfer,
	type WorkerHandlers,
	type WorkerOperation,
} from "../src/client-messaging.js";
import type * as WorkerTypes from "../src/lib/.types.js";
import { listen as listenWorker } from "../src/scope/worker.js";

type ApplicationProtocol = {
	requests: {
		add: WorkerOperation<{ a: number; b: number }, number>;
		buffer: WorkerOperation<ArrayBuffer, ArrayBuffer>;
		optional: WorkerOperation<string | undefined, number>;
		status: WorkerOperation<void, string>;
	};
	subscriptions: {
		progress: WorkerOperation<{ job: string }, number>;
		optional: WorkerOperation<string | undefined, number>;
		totals: WorkerOperation<void, number>;
	};
};

export type PublicTypesInTypesModule = [
	WorkerTypes.WorkerOperation,
	WorkerTypes.WorkerProtocol,
	WorkerTypes.MessageEndpoint,
	WorkerTypes.WorkerRequestOptions,
	WorkerTypes.WorkerSubscribeOptions,
	WorkerTypes.WorkerRequestContext,
	WorkerTypes.WorkerSubscriptionContext<unknown>,
	WorkerTypes.WorkerTransferResult<unknown>,
	WorkerTypes.WorkerSubscription,
	WorkerTypes.WorkerClient<ApplicationProtocol>,
	WorkerTypes.WorkerServer<ApplicationProtocol>,
	WorkerTypes.ProtocolType<WorkerTypes.WorkerServer<ApplicationProtocol>>,
	WorkerTypes.ProtocolType<readonly WorkerTypes.WorkerServer<ApplicationProtocol>[]>,
	WorkerTypes.WorkerHandlers<ApplicationProtocol>,
	WorkerTypes.WorkerListener<ApplicationProtocol>,
];

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

export type TransferListUsesPlatformType = Expect<
	Equal<NonNullable<WorkerTypes.WorkerRequestOptions["transfer"]>, readonly Transferable[]>
>;
const endpoint = {} as MessageEndpoint;
const client = connect<ApplicationProtocol>(endpoint);
const sum: Promise<number> = client.request("add", { a: 1, b: 2 });
const optional: Promise<number> = client.request("optional", "value");
const optionalUndefined: Promise<number> = client.request("optional", undefined);
const status: Promise<string> = client.request("status");
const totals = client.subscribe("totals", (value) => value.toFixed());
const progress = client.subscribe("progress", { job: "build" }, (value) => value.toFixed());
const optionalSubscription = client.subscribe("optional", "value", (value) => value.toFixed());

client.request("buffer", new ArrayBuffer(8));
client.request("buffer", new ArrayBuffer(8), { transfer: [new ArrayBuffer(8)] });

// @ts-expect-error unknown request name
client.request("missing");
// @ts-expect-error wrong request input
client.request("add", { a: "1", b: 2 });
// @ts-expect-error void requests do not accept an input value
client.request("status", "now");
// @ts-expect-error wrong subscription input
client.subscribe("progress", { id: 1 }, () => {});
// @ts-expect-error subscription events are numbers
client.subscribe("totals", (value: string) => value);

const handlers = {
	requests: {
		add: ({ a, b }) => a + b,
		buffer: (value) => transfer(value, [value]),
		optional: (value) => value?.length ?? 0,
		status: () => "ready",
	},
	subscriptions: {
		progress: ({ job }, { emit }) => emit(job.length),
		optional: (value, { emit }) => emit(value?.length ?? 0),
		totals: (_input, { emit }) => {
			emit(1);
			// @ts-expect-error this subscription emits numbers
			emit("one");
		},
	},
} satisfies WorkerHandlers<ApplicationProtocol>;

const server = serve<ApplicationProtocol>(endpoint, handlers);
const connections = listenWorker<ApplicationProtocol>(handlers);

connections.close();

export type ProtocolTypeIsPreserved = [
	Expect<Equal<ProtocolType<typeof server>, ApplicationProtocol>>,
	Expect<Equal<ProtocolType<typeof connections>, ApplicationProtocol>>,
];

declare const messagePort: MessagePort;
declare const dedicatedWorker: Worker;
declare const dedicatedWorkerScope: DedicatedWorkerGlobalScope;

connect<ApplicationProtocol>(messagePort);
connect<ApplicationProtocol>(dedicatedWorker);
serve<ApplicationProtocol>(dedicatedWorkerScope, handlers);

void sum;
void optional;
void optionalUndefined;
void status;
void totals;
void progress;
void optionalSubscription;
