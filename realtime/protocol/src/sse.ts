import { subprotocol } from "./realtime-protocol.js";

const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64Values = new Int16Array(128).fill(-1);

for (let index = 0; index < base64Alphabet.length; ++index) {
	base64Values[base64Alphabet.charCodeAt(index)] = index;
}

/** The negotiated media type for a Serve Tools event stream. */
export const eventStreamContentType = `text/event-stream;protocol=${subprotocol}`;

/** The negotiated media type for a finite Serve Tools binary response. */
export const binaryContentType = `application/octet-stream;protocol=${subprotocol}`;

/** One event decoded from a `text/event-stream` response. */
export interface ServerSentEvent {
	readonly data: string;
	readonly event: string;
	readonly id: string;
	readonly retry?: number;
}

/** Incrementally parses the standard server-sent event text format. */
export class EventStreamDecoder {
	readonly #decoder = new TextDecoder();
	#buffer = "";
	#data: string[] = [];
	#event = "";
	#id = "";
	#retry: number | undefined;
	#started = false;

	/** Pushes UTF-8 response bytes and returns every complete dispatched event. */
	push(chunk: ArrayBuffer | ArrayBufferView): ServerSentEvent[] {
		const bytes = ArrayBuffer.isView(chunk)
			? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
			: new Uint8Array(chunk);
		const text = this.#decoder.decode(bytes, { stream: true });

		return this.#consume(text, false);
	}

	/** Finishes UTF-8 decoding. An unterminated final event is intentionally not dispatched. */
	finish(): ServerSentEvent[] {
		const events = this.#consume(this.#decoder.decode(), true);

		this.#buffer = "";
		this.#data = [];
		this.#event = "";
		this.#retry = undefined;

		return events;
	}

	#consume(text: string, finish: boolean): ServerSentEvent[] {
		this.#buffer += text;

		if (!this.#started) {
			this.#started = true;

			if (this.#buffer.startsWith("\uFEFF")) {
				this.#buffer = this.#buffer.slice(1);
			}
		}

		const events: ServerSentEvent[] = [];

		let start = 0;

		for (let index = 0; index < this.#buffer.length; ++index) {
			const character = this.#buffer.charCodeAt(index);

			if (character !== 10 && character !== 13) {
				continue;
			}

			if (character === 13 && index + 1 === this.#buffer.length && !finish) {
				break;
			}

			this.#line(this.#buffer.slice(start, index), events);

			if (character === 13 && this.#buffer.charCodeAt(index + 1) === 10) {
				++index;
			}

			start = index + 1;
		}

		this.#buffer = this.#buffer.slice(start);

		return events;
	}

	#line(line: string, events: ServerSentEvent[]): void {
		if (line === "") {
			if (this.#data.length > 0) {
				events.push({
					data: this.#data.join("\n"),
					event: this.#event || "message",
					id: this.#id,
					...(this.#retry === undefined ? {} : { retry: this.#retry }),
				});
			}

			this.#data = [];
			this.#event = "";
			this.#retry = undefined;

			return;
		}

		if (line.startsWith(":")) {
			return;
		}

		const colon = line.indexOf(":");
		const field = colon < 0 ? line : line.slice(0, colon);
		const rawValue = colon < 0 ? "" : line.slice(colon + 1);
		const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

		switch (field) {
			case "data":
				this.#data.push(value);
				break;
			case "event":
				this.#event = value;
				break;
			case "id":
				if (!value.includes("\0")) {
					this.#id = value;
				}
				break;
			case "retry":
				if (/^[0-9]+$/.test(value)) {
					this.#retry = Number(value);
				}
				break;
		}
	}
}

/** Encodes one standard server-sent event. */
export function encodeServerSentEvent(data: string, event = "message", id?: string): Uint8Array {
	if (
		event.includes("\r") ||
		event.includes("\n") ||
		id?.includes("\r") ||
		id?.includes("\n") ||
		id?.includes("\0")
	) {
		throw new TypeError("Server-sent event fields cannot contain line breaks or null characters");
	}

	let text = event === "message" ? "" : `event: ${event}\n`;

	if (id !== undefined) {
		text += `id: ${id}\n`;
	}

	for (const line of data.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n")) {
		text += `data: ${line}\n`;
	}

	return new TextEncoder().encode(`${text}\n`);
}

/** Returns whether a media field contains the expected essence and Serve Tools protocol parameter. */
export function isNegotiatedMediaType(value: string | null, essence: string): boolean {
	if (!value) {
		return false;
	}

	for (const entry of value.split(",")) {
		const [candidate = "", ...rawParameters] = entry.split(";");

		if (candidate.trim().toLowerCase() !== essence) {
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

/** Encodes bytes as canonical padded base64 for an SSE `data` field. */
export function encodeBase64(payload: ArrayBuffer | ArrayBufferView): string {
	const bytes = ArrayBuffer.isView(payload)
		? new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
		: new Uint8Array(payload);

	let output = "";

	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index]!;
		const second = bytes[index + 1];
		const third = bytes[index + 2];

		output += base64Alphabet[first >> 2];
		output += base64Alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
		output += second === undefined ? "=" : base64Alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
		output += third === undefined ? "=" : base64Alphabet[third & 63];
	}

	return output;
}

/** Decodes canonical padded base64 from an SSE `data` field. */
export function decodeBase64(value: string): Uint8Array {
	if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
		throw new TypeError("Invalid base64 event data");
	}

	const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
	const output = new Uint8Array((value.length / 4) * 3 - padding);

	let offset = 0;

	for (let index = 0; index < value.length; index += 4) {
		const first = base64Values[value.charCodeAt(index)]!;
		const second = base64Values[value.charCodeAt(index + 1)]!;
		const third = value[index + 2] === "=" ? 0 : base64Values[value.charCodeAt(index + 2)]!;
		const fourth = value[index + 3] === "=" ? 0 : base64Values[value.charCodeAt(index + 3)]!;
		const bits = (first << 18) | (second << 12) | (third << 6) | fourth;

		if (offset < output.length) {
			output[offset++] = bits >> 16;
		}
		if (offset < output.length) {
			output[offset++] = bits >> 8;
		}
		if (offset < output.length) {
			output[offset++] = bits;
		}
	}

	return output;
}
