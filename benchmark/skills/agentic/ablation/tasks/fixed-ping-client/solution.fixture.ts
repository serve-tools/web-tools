import { defineAPI } from "@serve-tools/http-contract";
import { createStaticClient } from "@serve-tools/http-contract/client/static";

type Schema<T> = {
	"~standard": {
		version: 1;
		vendor: string;
		types?: { input: T; output: T };
		validate(value: unknown): { value: T } | { issues: Array<{ message: string }> };
	};
};
const schema = <T>(check: (value: unknown) => value is T): Schema<T> => ({
	"~standard": {
		version: 1,
		vendor: "fixture",
		validate(value) {
			return check(value) ? { value } : { issues: [{ message: "invalid" }] };
		},
	},
});

const ready = schema<{ ready: boolean }>(
	(value): value is { ready: boolean } =>
		typeof value === "object" && value !== null && typeof (value as { ready?: unknown }).ready === "boolean",
);
const unavailable = schema<{ error: "unavailable" }>(
	(value): value is { error: "unavailable" } =>
		typeof value === "object" && value !== null && (value as { error?: unknown }).error === "unavailable",
);
const api = defineAPI({ routes: { "/ping": { GET: { responses: { 200: ready, 503: unavailable } } } } });

export function createPingClient(fetchImpl: typeof fetch, baseURL: string) {
	if (typeof fetchImpl !== "function" || typeof baseURL !== "string") {
		throw new TypeError("input");
	}
	const base = new URL(baseURL);
	if (!/^https?:$/.test(base.protocol)) {
		throw new TypeError("baseURL");
	}
	const client = createStaticClient<typeof api>({ baseURL: base.href, fetch: fetchImpl });

	return {
		async ping(init?: RequestInit) {
			if (init !== undefined && (typeof init !== "object" || init === null || Array.isArray(init))) {
				throw new TypeError("init");
			}
			const headers = new Headers(init?.headers);
			headers.delete("accept");
			const result = await client.GET("/ping", { init: { headers, signal: init?.signal } as never });
			const requestURL = new URL("/ping", base).href;
			const status: number = result.status;
			if (status !== 200 && status !== 503) {
				throw new TypeError("status");
			}
			const validation = (result.status === 503 ? unavailable : ready)["~standard"].validate(result.body);
			if ("issues" in validation) {
				throw new TypeError("response");
			}
			return result.status === 503 ? { ready: false, requestURL } : { ready: result.body.ready, requestURL };
		},
	};
}
