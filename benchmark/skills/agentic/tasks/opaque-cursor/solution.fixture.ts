import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

interface Cursor {
	readonly offset: number;
	readonly label: string;
}

export function encodeCursor(input: Cursor): string {
	if (!isRecord(input) || Object.keys(input).length !== 2) {
		throw new TypeError("Invalid cursor");
	}
	if (!Number.isSafeInteger(input.offset) || input.offset < 0) {
		throw new TypeError("Invalid offset");
	}
	if (typeof input.label !== "string" || !input.label.isWellFormed()) {
		throw new TypeError("Invalid label");
	}

	const payload = new TextEncoder().encode(JSON.stringify({ v: 1, o: input.offset, l: input.label }));
	const storage = new Uint8Array(payload.byteLength + 2);

	storage.set(payload, 1);

	return toBase64(storage.subarray(1, -1), { alphabet: "base64url", omitPadding: true });
}

export function decodeCursor(token: string): Cursor {
	if (typeof token !== "string" || token.includes("=") || !/^[A-Za-z0-9_-]*$/.test(token)) {
		throw new TypeError("Invalid cursor encoding");
	}

	let bytes: Uint8Array;

	try {
		bytes = Buffer.from(token, "base64url");
	} catch {
		throw new TypeError("Invalid cursor encoding");
	}

	if (toBase64(bytes, { alphabet: "base64url", omitPadding: true }) !== token) {
		throw new TypeError("Non-canonical cursor encoding");
	}

	let value: unknown;

	try {
		value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch {
		throw new TypeError("Invalid cursor payload");
	}

	if (
		!isRecord(value) ||
		Object.keys(value).length !== 3 ||
		value.v !== 1 ||
		!Number.isSafeInteger(value.o) ||
		(value.o as number) < 0 ||
		typeof value.l !== "string" ||
		!value.l.isWellFormed()
	) {
		throw new TypeError("Invalid cursor payload");
	}

	return { offset: value.o as number, label: value.l };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
