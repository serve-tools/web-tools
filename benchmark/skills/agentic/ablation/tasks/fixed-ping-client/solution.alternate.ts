import type { Schema as StandardSchemaV1 } from "@serve-tools/http-contract";
import { defineAPI } from "@serve-tools/http-contract";
import { createStaticClient } from "@serve-tools/http-contract/client/static";

const readySchema = schema<{ ready: boolean }>(
	(value): value is { ready: boolean } => exact(value, ["ready"]) && typeof value.ready === "boolean",
);
const unavailableSchema = schema<{ error: "unavailable" }>(
	(value): value is { error: "unavailable" } => exact(value, ["error"]) && value.error === "unavailable",
);
const api = defineAPI({ routes: { "/ping": { GET: { responses: { 200: readySchema, 503: unavailableSchema } } } } });

export function createPingClient(fetchImpl: typeof fetch, baseURL: string) {
	if (typeof fetchImpl !== "function" || typeof baseURL !== "string") {
		throw new TypeError("Invalid client input");
	}
	let requestURL: string;
	try {
		const base = new URL(baseURL);
		if (!/^https?:$/.test(base.protocol)) {
			throw new TypeError("Invalid base URL");
		}
		requestURL = new URL("/ping", base).href;
	} catch {
		throw new TypeError("Invalid base URL");
	}
	const client = createStaticClient<typeof api>({ fetch: fetchImpl, baseURL });
	return {
		async ping(init?: RequestInit): Promise<{ ready: boolean; requestURL: string }> {
			if (init !== undefined && (typeof init !== "object" || init === null || Array.isArray(init))) {
				throw new TypeError("Invalid init");
			}
			const requestInit = init === undefined ? undefined : pingInit(init);
			const result = await client.GET("/ping", requestInit === undefined ? undefined : { init: requestInit });
			if (result.status === 200) {
				if (!isReady(result.body)) {
					throw new TypeError("Invalid ping response");
				}
				return { ready: result.body.ready, requestURL };
			}
			if (result.status === 503) {
				if (!isUnavailable(result.body)) {
					throw new TypeError("Invalid ping response");
				}
				return { ready: false, requestURL };
			}
			throw new TypeError("Undeclared ping response status");
		},
	};
}

function pingInit(init: RequestInit): Omit<RequestInit, "body" | "method" | "mode"> {
	const { body: _body, method: _method, headers, ...rest } = init;
	const normalizedHeaders = new Headers(headers);
	normalizedHeaders.delete("accept");
	return { ...rest, headers: normalizedHeaders };
}

function schema<T>(check: (value: unknown) => value is T): StandardSchemaV1<T> {
	return {
		"~standard": {
			version: 1,
			vendor: "alternate",
			validate: (value) => (check(value) ? { value } : { issues: [{ message: "Invalid" }] }),
		},
	};
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key))
	);
}

function isReady(value: unknown): value is { ready: boolean } {
	return typeof value === "object" && value !== null && "ready" in value && typeof value.ready === "boolean";
}

function isUnavailable(value: unknown): value is { error: "unavailable" } {
	return typeof value === "object" && value !== null && "error" in value && value.error === "unavailable";
}
