/** Options for encoding a Uint8Array as a base64 string. */
export interface ToBase64Options {
	/** The standard base64 alphabet or its URL-safe variant. */
	alphabet?: "base64" | "base64url";

	/** Whether trailing padding characters are omitted from the result. */
	omitPadding?: boolean;
}

/** Encodes a Uint8Array as base64 or base64url in Node.js. */
export declare function toBase64(value: Uint8Array, options?: ToBase64Options): string;
