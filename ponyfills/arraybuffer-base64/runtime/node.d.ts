export interface ToBase64Options {
	alphabet?: "base64" | "base64url";
	omitPadding?: boolean;
}

/** Encodes a Uint8Array as base64 or base64url in Node.js. */
export declare function toBase64(value: Uint8Array, options?: ToBase64Options): string;
