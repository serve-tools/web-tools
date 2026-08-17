import { deserialize, serialize } from "./realtime-protocol.js";

const headerLength = 5;
const binaryEncoding = 0;
const structuredEncoding = 1;

/** One decoded typed datagram envelope. */
export interface DecodedDatagram {
	/** The connection-local kind identifier registered on the reliable control stream. */
	readonly kind: number;

	/** The decoded structured value, or a zero-copy view of binary payload bytes. */
	readonly value: unknown;
}

/** Encodes one typed datagram with a compact kind and payload-encoding prefix. */
export function encodeDatagram(kind: number, value: unknown): Uint8Array {
	if (!Number.isSafeInteger(kind) || kind < 0 || kind > 0xffff_ffff) {
		throw new RangeError("The datagram kind must be a 32-bit unsigned integer");
	}

	const binary = value instanceof ArrayBuffer || ArrayBuffer.isView(value);
	const payload = binary
		? value instanceof ArrayBuffer
			? new Uint8Array(value)
			: new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		: new Uint8Array(serialize(value));
	const output = new Uint8Array(headerLength + payload.byteLength);

	new DataView(output.buffer).setUint32(0, kind);

	output[4] = binary ? binaryEncoding : structuredEncoding;

	output.set(payload, headerLength);

	return output;
}

/** Decodes one typed datagram envelope. */
export function decodeDatagram(payload: ArrayBuffer | ArrayBufferView): DecodedDatagram {
	const bytes = ArrayBuffer.isView(payload)
		? new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
		: new Uint8Array(payload);

	if (bytes.byteLength < headerLength) {
		throw new TypeError("The typed datagram is missing its envelope");
	}

	const kind = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
	const encoding = bytes[4];
	const data = bytes.subarray(headerLength);

	if (encoding === binaryEncoding) {
		return { kind, value: data };
	}

	if (encoding === structuredEncoding) {
		return { kind, value: deserialize(data) };
	}

	throw new TypeError("The typed datagram has an unknown payload encoding");
}
