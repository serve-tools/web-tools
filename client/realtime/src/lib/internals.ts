import type { ErrorRecord } from "@serve-tools/realtime-protocol";
import { RemoteError } from "./RemoteError.js";

export const noop = (): void => {};

export const errorRecord = (reason: unknown): ErrorRecord =>
	reason instanceof Error
		? {
				name: reason.name || "Error",
				message: reason.message,
				...(reason.stack ? { stack: reason.stack } : {}),
			}
		: { name: "Error", message: String(reason) };

export const remoteError = ({ name, message, stack }: ErrorRecord): RemoteError =>
	new RemoteError(name, message, stack);

export const connectionClosedError = (reason?: unknown): Error =>
	Object.assign(
		new Error(
			reason instanceof Error
				? reason.message
				: reason === undefined
					? "The connection is closed"
					: String(reason),
		),
		{ name: "ConnectionClosedError" },
	);

export const protocolError = (reason?: unknown): Error =>
	Object.assign(new Error(reason instanceof Error ? reason.message : String(reason ?? "Invalid protocol message")), {
		name: "ProtocolError",
	});

export const callSafely = <Value>(callback: (value: Value) => void, value: Value): void => {
	try {
		callback(value);
	} catch (error) {
		reportError(error);
	}
};
