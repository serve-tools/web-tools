import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

export function encodeParts(parts: readonly Uint8Array[]): string {
	if (!Array.isArray(parts)) {
		throw new TypeError("Invalid parts");
	}

	let length = 0;

	for (let index = 0; index < parts.length; ++index) {
		if (!(index in parts) || !(parts[index] instanceof Uint8Array)) {
			throw new TypeError("Invalid parts");
		}

		length += parts[index]!.byteLength;
	}

	const bytes = new Uint8Array(length);
	let offset = 0;

	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.byteLength;
	}

	return toBase64(bytes, { alphabet: "base64url", omitPadding: true });
}
