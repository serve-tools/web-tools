import type { ToBase64Options } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

declare global {
	interface Uint8Array<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike> {
		/** Encodes this Uint8Array as base64 or base64url. */
		toBase64(options?: ToBase64Options): string;
	}
}

export {};
