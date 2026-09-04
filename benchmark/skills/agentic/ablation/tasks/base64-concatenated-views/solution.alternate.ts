import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

const isUint8Array = (value: unknown): value is Uint8Array =>
	ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]";

export function encodeParts(parts: Uint8Array[]): string {
	if (
		!Array.isArray(parts) ||
		Array.from({ length: parts.length }, (_, index) => !Object.hasOwn(parts, index)).some(Boolean)
	) {
		throw new TypeError("parts must be a dense Array");
	}

	let length = 0;
	for (const part of parts) {
		if (!isUint8Array(part)) {
			throw new TypeError("parts must contain Uint8Array values");
		}
		length += part.byteLength;
	}

	const output = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		output.set(part, offset);
		offset += part.byteLength;
	}

	return toBase64(output, { alphabet: "base64url", omitPadding: true });
}
