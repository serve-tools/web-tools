/// <reference lib="esnext.disposable" />
/// <reference lib="webworker" />

export type {
	MessageEndpoint,
	WorkerClient,
	WorkerHandlers,
	WorkerOperation,
	WorkerProtocol,
	WorkerRequestContext,
	WorkerRequestOptions,
	WorkerServer,
	WorkerSubscribeOptions,
	WorkerSubscription,
	WorkerSubscriptionContext,
	WorkerTransferResult,
} from "./lib/.types.js";
export * from "./lib/connect.js";
export * from "./lib/serve.js";
export * from "./lib/transfer.js";
export * from "./lib/WorkerRemoteError.js";
