import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

/** A compile-tested recipe for URL-safe base64 without padding. */
export function encodeIdentifier(bytes: Uint8Array): string {
	return toBase64(bytes, { alphabet: "base64url", omitPadding: true });
}
