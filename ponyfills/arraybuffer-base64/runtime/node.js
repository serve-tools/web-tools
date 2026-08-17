import { Buffer } from "node:buffer";

const getTypedArrayName = Object.getOwnPropertyDescriptor(
	Object.getPrototypeOf(Uint8Array.prototype),
	Symbol.toStringTag,
).get;

/**
 * Encodes a Uint8Array as base64 or base64url in Node.js.
 *
 * @param {Uint8Array} value
 * @param {{ alphabet?: "base64" | "base64url"; omitPadding?: boolean }} [options]
 * @returns {string}
 */
export const toBase64 = (value, options) => {
	if (getTypedArrayName.call(value) !== "Uint8Array") {
		throw new TypeError("Expected a Uint8Array");
	}

	Uint8Array.prototype.values.call(value);

	if (options !== undefined && (options === null || (typeof options !== "object" && typeof options !== "function"))) {
		throw new TypeError("Expected options to be an object");
	}

	const alphabetOption = options?.alphabet;
	const alphabet = alphabetOption === undefined ? "base64" : alphabetOption;

	if (alphabet !== "base64" && alphabet !== "base64url") {
		throw new TypeError("Invalid base64 alphabet");
	}

	const omitPadding = Boolean(options?.omitPadding);

	let result = Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString(alphabet);

	if (alphabet === "base64url" && !omitPadding) {
		result += "=".repeat((4 - (result.length % 4)) % 4);
	} else if (alphabet === "base64" && omitPadding) {
		result = result.replace(/=+$/, "");
	}

	return result;
};
