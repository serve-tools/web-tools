import { subprotocol } from "./messages.js";

/** Leading byte identifying the reliable request and subscription stream. */
export const webTransportOperationsRole = 0;

/** Leading byte identifying the reliable datagram registry stream. */
export const webTransportDatagramRegistryRole = 1;

/** Returns whether a WebSocket protocol header offers the Serve Tools subprotocol. */
export const offersWebSocketSubprotocol = (value: string | readonly string[] | null | undefined): boolean =>
	(typeof value === "string" ? value : (value?.join(",") ?? ""))
		.split(",")
		.some((entry) => entry.trim() === subprotocol);

/** Returns whether a Structured Fields WebTransport protocol list offers the Serve Tools subprotocol. */
export const offersWebTransportSubprotocol = (value: string | readonly string[] | undefined): boolean => {
	const input = typeof value === "string" ? value : (value?.join(",") ?? "");
	let offset = 0;
	let offered = false;

	while (offset < input.length) {
		while (input[offset] === " " || input[offset] === "\t") {
			++offset;
		}

		if (input[offset++] !== '"') {
			return false;
		}

		let item = "";

		while (offset < input.length && input[offset] !== '"') {
			if (input[offset] === "\\") {
				++offset;

				if (input[offset] !== '"' && input[offset] !== "\\") {
					return false;
				}
			}

			const code = input.charCodeAt(offset);

			if (offset >= input.length || code < 0x20 || code > 0x7e) {
				return false;
			}

			item += input[offset++];
		}

		if (input[offset++] !== '"') {
			return false;
		}
		offered ||= item === subprotocol;

		while (input[offset] === " " || input[offset] === "\t") {
			++offset;
		}

		if (offset < input.length && input[offset++] !== ",") {
			return false;
		}
		if (offset === input.length && input.endsWith(",")) {
			return false;
		}
	}

	return offered;
};
