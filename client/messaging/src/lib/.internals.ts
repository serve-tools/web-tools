import type { ErrorRecord, MessageEndpoint, Subscription, TransferResult, WireMessage } from "./.types.js";
import { RemoteError } from "./RemoteError.js";

export const protocol = "@serve-tools/client-messaging/2";

export const transferBrand: unique symbol = Symbol("Transferred value");

export function noop(): void {}

export const inactiveSubscription: Subscription = Object.freeze({
	active: false,
	unsubscribe: noop,
	[Symbol.dispose]: noop,
});

export const isWireMessage = (value: unknown): value is WireMessage => {
	if (!Array.isArray(value) || value[0] !== protocol) {
		return false;
	}

	if (value[1] === "close") {
		return isErrorRecord(value[2]);
	}

	if (value[1] === "lease") {
		return typeof value[2] === "string";
	}

	if (!Number.isSafeInteger(value[2]) || (value[2] as number) < 0) {
		return false;
	}

	switch (value[1]) {
		case "request":
		case "subscription":
			return typeof value[3] === "string";
		case "reject":
			return isErrorRecord(value[3]);
		case "next":
		case "resolve":
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
	typeof (value as Partial<ErrorRecord>).message === "string" &&
	((value as Partial<ErrorRecord>).stack === undefined || typeof (value as Partial<ErrorRecord>).stack === "string");

export const post = (endpoint: MessageEndpoint, message: WireMessage, transfer?: readonly Transferable[]): void => {
	if (transfer?.length) {
		endpoint.postMessage(message, transfer);
	} else {
		endpoint.postMessage(message);
	}
};

export const isTransferResult = (value: unknown): value is TransferResult<unknown> =>
	!!value && typeof value === "object" && (value as Record<PropertyKey, unknown>)[transferBrand] === true;

export const errorRecord = (reason: unknown): ErrorRecord => {
	if (!(reason instanceof Error)) {
		return { name: "Error", message: String(reason) };
	}

	return reason.stack
		? { name: reason.name || "Error", message: reason.message, stack: reason.stack }
		: { name: reason.name || "Error", message: reason.message };
};

export const remoteError = ({ name, message, stack }: ErrorRecord): RemoteError =>
	new RemoteError(name, message, stack);

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

export const report = (error: unknown): void => reportError(error);
