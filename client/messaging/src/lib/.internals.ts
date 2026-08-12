import type { ErrorRecord, MessageEndpoint, WireMessage, WorkerSubscription, WorkerTransferResult } from "./.types.js";
import { WorkerRemoteError } from "./WorkerRemoteError.js";

export const protocol = "@serve-tools/client-messaging/1";

export const transferBrand: unique symbol = Symbol("Transferred value");

export function noop(): void {}

export const inactiveSubscription: WorkerSubscription = Object.freeze({
	active: false,
	unsubscribe: noop,
	[Symbol.dispose]: noop,
});

export const isWireMessage = (value: unknown): value is WireMessage => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const message = value as {
		protocol?: unknown;
		type?: unknown;
		id?: unknown;
		kind?: unknown;
		name?: unknown;
		ok?: unknown;
		error?: unknown;
	};

	if (message.protocol !== protocol || typeof message.type !== "string") {
		return false;
	}

	if (message.type === "close") {
		return isErrorRecord(message.error);
	}

	if (!Number.isSafeInteger(message.id) || (message.id as number) < 0) {
		return false;
	}

	switch (message.type) {
		case "open":
			return (message.kind === "request" || message.kind === "subscription") && typeof message.name === "string";
		case "settle":
			return message.ok === true || (message.ok === false && isErrorRecord(message.error));
		case "next":
		case "cancel":
			return true;
		default:
			return false;
	}
};

export const isErrorRecord = (value: unknown): value is ErrorRecord =>
	!!value &&
	typeof value === "object" &&
	typeof (value as Partial<ErrorRecord>).name === "string" &&
	typeof (value as Partial<ErrorRecord>).message === "string";

export const post = (endpoint: MessageEndpoint, message: WireMessage, transfer?: readonly Transferable[]): void => {
	if (transfer?.length) {
		endpoint.postMessage(message, transfer);
	} else {
		endpoint.postMessage(message);
	}
};

export const unwrapTransfer = (value: unknown): { value: unknown; transfer?: readonly Transferable[] } =>
	isTransferResult(value) ? value : { value };

const isTransferResult = (value: unknown): value is WorkerTransferResult<unknown> =>
	!!value && typeof value === "object" && (value as Record<PropertyKey, unknown>)[transferBrand] === true;

export const errorRecord = (reason: unknown): ErrorRecord => {
	if (!(reason instanceof Error)) {
		return { name: "Error", message: String(reason) };
	}

	return reason.stack
		? { name: reason.name || "Error", message: reason.message, stack: reason.stack }
		: { name: reason.name || "Error", message: reason.message };
};

export const remoteError = ({ name, message, stack }: ErrorRecord): WorkerRemoteError =>
	new WorkerRemoteError(name, message, stack);

export const connectionClosedError = (reason?: unknown): Error => {
	const message =
		reason instanceof Error ? reason.message : reason === undefined ? "The connection is closed" : String(reason);

	return Object.assign(new Error(message), { name: "ConnectionClosedError" });
};

export const callSafely = <Value>(callback: (value: Value) => void, value: Value): void => {
	try {
		callback(value);
	} catch (error) {
		report(error);
	}
};

export const report =
	globalThis.reportError ??
	((reason: unknown): void =>
		queueMicrotask(() => {
			throw reason;
		}));
