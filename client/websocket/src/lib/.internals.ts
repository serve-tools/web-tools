import type { ErrorRecord } from "@serve-tools/realtime-protocol";
import { RemoteError } from "./RemoteError.js";

export function noop(): void {}

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

const reasonMessage = (reason: unknown, fallback: string): string =>
	reason instanceof Error ? reason.message : reason === undefined ? fallback : String(reason);

export const connectionClosedError = (reason?: unknown): Error => {
	return Object.assign(new Error(reasonMessage(reason, "The connection is closed")), {
		name: "ConnectionClosedError",
	});
};

export const protocolError = (reason?: unknown): Error => {
	return Object.assign(new Error(reasonMessage(reason, "Invalid protocol message")), { name: "ProtocolError" });
};

export const callSafely = <Value>(callback: (value: Value) => void, value: Value): void => {
	try {
		callback(value);
	} catch (error) {
		reportError(error);
	}
};
