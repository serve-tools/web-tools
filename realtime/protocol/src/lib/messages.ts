import type { ClientMessage, ErrorRecord, ServerMessage } from "./types.js";

/** The current request and subscription envelope version. */
export const protocol = "@serve-tools/realtime/1";

/** The application protocol identifier negotiated by supported network transports. */
export const subprotocol = "serve-tools.realtime.v1";

/** Returns whether a value is a serialized protocol error. */
export const isErrorRecord = (value: unknown): value is ErrorRecord =>
	!!value &&
	typeof value === "object" &&
	typeof (value as Partial<ErrorRecord>).name === "string" &&
	typeof (value as Partial<ErrorRecord>).message === "string" &&
	((value as Partial<ErrorRecord>).stack === undefined || typeof (value as Partial<ErrorRecord>).stack === "string");

const validOperationID = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** Returns whether a decoded value is a current client message. */
export const isClientMessage = (value: unknown): value is ClientMessage => {
	if (!Array.isArray(value) || value[0] !== protocol) {
		return false;
	}

	if (value[1] === "close") {
		return value.length === 3 && isErrorRecord(value[2]);
	}

	if (!validOperationID(value[2])) {
		return false;
	}

	switch (value[1]) {
		case "cancel":
			return value.length === 3;
		case "request":
		case "subscribe":
			return value.length === 5 && typeof value[3] === "string";
		default:
			return false;
	}
};

/** Returns whether a decoded value is a current server message. */
export const isServerMessage = (value: unknown): value is ServerMessage => {
	if (!Array.isArray(value) || value[0] !== protocol) {
		return false;
	}

	if (value[1] === "close") {
		return value.length === 3 && isErrorRecord(value[2]);
	}

	if (!validOperationID(value[2])) {
		return false;
	}

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
