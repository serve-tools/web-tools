import type { HTTPMethod } from "../http-contract.js";
import { ProtocolError } from "./error.js";
import { assertJSONValue, isJSONMediaType } from "./json.js";

export interface ClientFetchOptions {
	readonly body?: unknown;
	readonly init?: unknown;
}

interface RuntimeHTTPResult {
	readonly body: unknown;
	readonly ok: boolean;
	readonly status: number;
	readonly response: Response;
}

export function parseClientBaseURL(input: string | URL): URL {
	try {
		const url = new URL(input);

		if (url.protocol === "http:" || url.protocol === "https:") {
			return url;
		}
	} catch {
		// The protocol error below intentionally normalizes native URL failures.
	}

	throw new ProtocolError("Invalid client base URL");
}

export async function fetchJSON<InitExtension extends object>(
	fetchImplementation: (
		input: Parameters<typeof globalThis.fetch>[0],
		init?: RequestInit & Partial<InitExtension>,
	) => ReturnType<typeof globalThis.fetch>,
	method: HTTPMethod,
	path: string,
	url: string,
	options: ClientFetchOptions,
): Promise<RuntimeHTTPResult> {
	const requestInit = parseRequestInit(method, path, options.init);

	if (requestInit.mode === "no-cors") {
		throw new ProtocolError("A JSON HTTP request cannot use no-cors mode.", { method, path });
	}

	const headers = new Headers(requestInit.headers);

	headers.set("accept", "application/json");
	headers.delete("content-type");

	let body: string | undefined;

	if (Object.hasOwn(options, "body")) {
		assertJSONValue(options.body, "the client request body");
		headers.set("content-type", "application/json");
		body = JSON.stringify(options.body);
	}

	const init: RequestInit = { ...requestInit, method, headers };

	if (body !== undefined) {
		init.body = body;
	}
	const response = await fetchImplementation(url, init as RequestInit & Partial<InitExtension>);

	const result = { status: response.status, response };

	if (response.status === 204 || response.status === 205) {
		return { ...result, body: undefined, ok: true };
	}

	const errorOptions = { method, path, ...result };

	if (!isJSONMediaType(response.headers.get("content-type"))) {
		throw new ProtocolError("An HTTP response must use a JSON media type.", errorOptions);
	}

	const responseBody = await response.text();
	let value: unknown;

	try {
		value = JSON.parse(responseBody);
	} catch (cause) {
		throw new ProtocolError("An HTTP response contained invalid JSON.", {
			...errorOptions,
			cause,
		});
	}

	return { ...result, body: value, ok: response.ok };
}

function parseRequestInit(method: HTTPMethod, path: string, input: unknown): RequestInit {
	if (input === undefined) {
		return {};
	}

	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new ProtocolError("Invalid client request init", { method, path });
	}

	const prototype = Object.getPrototypeOf(input);
	const descriptors = Object.getOwnPropertyDescriptors(input);

	if (
		(prototype !== Object.prototype && prototype !== null) ||
		Reflect.ownKeys(descriptors).some((key) => !("value" in descriptors[key as keyof typeof descriptors]!)) ||
		Object.hasOwn(input, "body") ||
		Object.hasOwn(input, "method")
	) {
		throw new ProtocolError("Invalid client request init", { method, path });
	}

	return Object.assign(Object.create(null), input) as RequestInit;
}
