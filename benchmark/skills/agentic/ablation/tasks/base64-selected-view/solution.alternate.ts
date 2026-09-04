import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

const isUint8Array = (value: unknown): value is Uint8Array =>
	ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]";

export function encodeSlice(bytes: Uint8Array, start: number, end: number, alphabet: "base64" | "base64url"): string {
	if (!isUint8Array(bytes) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
		throw new TypeError("bytes and slice bounds are invalid");
	}
	if (start < 0 || end < start || end > bytes.byteLength || (alphabet !== "base64" && alphabet !== "base64url")) {
		throw new TypeError("slice bounds or alphabet are invalid");
	}

	return toBase64(bytes.subarray(start, end), { alphabet, omitPadding: alphabet === "base64url" });
}
