import type { ToBase64Options } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";
import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

/** Defaults only omission; explicit `null`, invalid fields, and coercive booleans are rejected. */
export const normalizeBase64Options = (value: unknown = undefined): ToBase64Options => {
	if (value === undefined) {
		return {};
	}

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("Base64 options must be an object");
	}

	const input = value as Record<string, unknown>;

	if (Object.keys(input).some((key) => key !== "alphabet" && key !== "omitPadding")) {
		throw new TypeError("Base64 options contain an unknown field");
	}

	if (input.alphabet !== undefined && input.alphabet !== "base64" && input.alphabet !== "base64url") {
		throw new TypeError("Invalid base64 alphabet");
	}

	if (input.omitPadding !== undefined && typeof input.omitPadding !== "boolean") {
		throw new TypeError("omitPadding must be a boolean");
	}

	return {
		...(input.alphabet === undefined ? {} : { alphabet: input.alphabet }),
		...(input.omitPadding === undefined ? {} : { omitPadding: input.omitPadding }),
	} as ToBase64Options;
};

/** Encodes exactly the selected Uint8Array view without modifying a global prototype. */
export const encodeBytes = (value: Uint8Array, options: unknown = undefined): string =>
	toBase64(value, normalizeBase64Options(options));

/** Encodes UTF-8 text through the same Node-only ponyfill boundary. */
export const encodeUTF8 = (value: string, options: unknown = undefined): string =>
	encodeBytes(new TextEncoder().encode(value), options);

// Add your task adapter below.
