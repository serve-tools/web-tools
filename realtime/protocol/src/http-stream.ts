import { subprotocol } from "./realtime-protocol.js";

/** The negotiated media type for Serve Tools binary HTTP exchanges and streams. */
export const contentType = `application/octet-stream;protocol=${subprotocol}`;

/** Returns whether a media field selects the Serve Tools binary HTTP protocol. */
export function isNegotiatedContentType(value: string | null): boolean {
	if (!value) {
		return false;
	}

	for (const entry of value.split(",")) {
		const [candidate = "", ...rawParameters] = entry.split(";");

		if (candidate.trim().toLowerCase() !== "application/octet-stream") {
			continue;
		}

		for (const rawParameter of rawParameters) {
			const separator = rawParameter.indexOf("=");

			if (separator < 0) {
				continue;
			}

			const name = rawParameter.slice(0, separator).trim().toLowerCase();
			const raw = rawParameter.slice(separator + 1).trim();
			const parameter = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;

			if (name === "protocol" && parameter === subprotocol) {
				return true;
			}
		}
	}

	return false;
}
