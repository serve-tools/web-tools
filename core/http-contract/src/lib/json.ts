import { ProtocolError } from "./error.js";

const JSON_MEDIA_TYPE_PATTERN = /^application\/(?:json|[!#$%&'*+.^_`|~0-9a-z-]+\+json)$/i;

/** Returns whether a Content-Type value denotes a supported JSON media type. */
export function isJSONMediaType(value: string | null): boolean {
	if (value === null) {
		return false;
	}

	return JSON_MEDIA_TYPE_PATTERN.test(value.split(";", 1)[0]!.trim());
}

/** Asserts that a value can be represented exactly by the package's JSON wire format. */
export function assertJSONValue(value: unknown, detail?: string): void {
	try {
		assertValue(value, new Set());
	} catch (cause) {
		if (cause instanceof ProtocolError) {
			throw cause;
		}

		throw new ProtocolError(detail ? `Invalid JSON value for ${detail}.` : "Invalid JSON value.");
	}
}

function assertValue(value: unknown, ancestors: Set<object>): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") {
		return;
	}

	if (typeof value === "number") {
		if (Number.isFinite(value)) {
			return;
		}

		throw new TypeError();
	}

	if (typeof value !== "object") {
		throw new TypeError();
	}
	if (ancestors.has(value)) {
		throw new TypeError();
	}

	const prototype = Object.getPrototypeOf(value);

	if (Array.isArray(value)) {
		if (prototype !== Array.prototype) {
			throw new TypeError();
		}

		ancestors.add(value);

		if (Reflect.ownKeys(value).length !== value.length + 1) {
			throw new TypeError();
		}

		for (let index = 0; index < value.length; ++index) {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));

			if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
				throw new TypeError();
			}

			assertValue(descriptor.value, ancestors);
		}

		ancestors.delete(value);

		return;
	}

	if (prototype !== Object.prototype && prototype !== null) {
		throw new TypeError();
	}

	ancestors.add(value);

	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string") {
			throw new TypeError();
		}

		const descriptor = Object.getOwnPropertyDescriptor(value, key);

		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
			throw new TypeError();
		}

		assertValue(descriptor.value, ancestors);
	}

	ancestors.delete(value);
}
