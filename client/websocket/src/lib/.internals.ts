import type { ErrorRecord, ServerMessage } from "./.types.js";
import { RemoteError } from "./RemoteError.js";

export const protocol = "@serve-tools/websocket/1";

export function noop(): void {}

export const isErrorRecord = (value: unknown): value is ErrorRecord =>
	!!value &&
	typeof value === "object" &&
	typeof (value as Partial<ErrorRecord>).name === "string" &&
	typeof (value as Partial<ErrorRecord>).message === "string" &&
	((value as Partial<ErrorRecord>).stack === undefined || typeof (value as Partial<ErrorRecord>).stack === "string");

export const isServerMessage = (value: unknown): value is ServerMessage => {
	if (!Array.isArray(value) || value[0] !== protocol) return false;

	if (value[1] === "close") return value.length === 3 && isErrorRecord(value[2]);

	if (!Number.isSafeInteger(value[2]) || (value[2] as number) < 0) return false;

	switch (value[1]) {
		case "complete":
			return value.length === 3;
		case "event":
		case "resolve":
			return value.length === 4;
		case "reject":
			return value.length === 4 && isErrorRecord(value[3]);
		default:
			return false;
	}
};

export const errorRecord = (reason: unknown): ErrorRecord => {
	if (!(reason instanceof Error)) return { name: "Error", message: String(reason) };

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

export const protocolError = (reason?: unknown): Error => {
	const message =
		reason instanceof Error ? reason.message : reason === undefined ? "Invalid protocol message" : String(reason);

	return Object.assign(new Error(message), { name: "ProtocolError" });
};

export const callSafely = <Value>(callback: (value: Value) => void, value: Value): void => {
	try {
		callback(value);
	} catch (error) {
		report(error);
	}
};

export const report = (error: unknown): void => reportError(error);
