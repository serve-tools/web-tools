import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

export function encodeSlice(bytes: Uint8Array, start: number, end: number, alphabet: "base64" | "base64url"): string {
	if (
		!(bytes instanceof Uint8Array) ||
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(end) ||
		start < 0 ||
		end < start ||
		end > bytes.byteLength ||
		(alphabet !== "base64" && alphabet !== "base64url")
	) {
		throw new TypeError("Invalid slice");
	}

	const options = alphabet === "base64url" ? ({ alphabet, omitPadding: true } as const) : ({ alphabet } as const);

	return toBase64(bytes.subarray(start, end), options);
}
