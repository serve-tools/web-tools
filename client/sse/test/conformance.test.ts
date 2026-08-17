import { protocol, serialize } from "@serve-tools/realtime-protocol";
import {
	binaryContentType,
	encodeBase64,
	encodeServerSentEvent,
	eventStreamContentType,
} from "@serve-tools/realtime-protocol/sse";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "../../../server/sse/src/server-sse.js";
import { connect } from "../src/client-sse.js";

if (!("toBase64" in Uint8Array.prototype)) {
	Object.defineProperty(Uint8Array.prototype, "toBase64", {
		configurable: true,
		value(this: Uint8Array): string {
			let binary = "";

			for (const byte of this) {
				binary += String.fromCharCode(byte);
			}

			return btoa(binary);
		},
	});
}

interface TestProtocol {
	requests: {
		add(input: { a: number; b: number }): number;
		identity(): string;
	};
	subscriptions: {
		numbers(start: number): number;
	};
}

const handlers = {
	requests: {
		add: ({ a, b }: { a: number; b: number }) => a + b,
		identity: (_input: undefined, { connection }: { connection: { user: string } }) => connection.user,
	},
	subscriptions: {
		numbers: (start: number, { emit, complete }: { emit(value: number): void; complete(): void }) => {
			emit(start);
			emit(start + 1);
			complete();
		},
	},
};

afterEach(() => vi.unstubAllGlobals());

describe("Fetch SSE conformance", () => {
	it("runs requests and subscriptions through the real server handler", async () => {
		const server = createHandler<TestProtocol, { user: string }>(handlers, {
			authorize: (request) => ({ user: request.headers.get("authorization") ?? "anonymous" }),
		});
		const fetcher: typeof fetch = (input, init) => server(new Request(input, init));
		const client = connect<TestProtocol>("https://example.test/realtime", {
			fetch: fetcher,
			headers: ({ name }) => ({ Authorization: name === "identity" ? "ada" : "client" }),
		});

		await expect(client.request("add", { a: 2, b: 5 })).resolves.toBe(7);
		await expect(client.request("identity")).resolves.toBe("ada");

		const values: number[] = [];
		const completed = Promise.withResolvers<void>();

		client.subscribe("numbers", 3, (value) => values.push(value), { onComplete: completed.resolve });
		await completed.promise;

		expect(values).toEqual([3, 4]);
		client.close();
	});

	it("rejects responses that do not negotiate the application protocol", async () => {
		const client = connect<TestProtocol>("https://example.test/realtime", {
			fetch: async () =>
				new Response(new ArrayBuffer(0), { headers: { "Content-Type": "application/octet-stream" } }),
		});

		await expect(client.request("identity")).rejects.toMatchObject({ name: "ProtocolError" });
		client.close();
	});

	it("selects the response representation from the operation when Accept lists both", async () => {
		const server = createHandler<TestProtocol, { user: string }>(handlers, {
			authorize: () => ({ user: "test" }),
		});
		const response = await server(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: {
					Accept: `${binaryContentType}, ${eventStreamContentType}`,
					"Content-Type": binaryContentType,
				},
				body: serialize([protocol, "request", 1, "add", { a: 3, b: 4 }]),
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(binaryContentType);
	});

	it("settles an aborted finite server request", async () => {
		interface PendingProtocol {
			requests: { hold(): never };
		}

		const server = createHandler<PendingProtocol>({
			requests: { hold: () => new Promise<never>(() => undefined) },
		});
		const controller = new AbortController();
		const reason = new Error("gone");
		const response = server(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: binaryContentType, "Content-Type": binaryContentType },
				body: serialize([protocol, "request", 1, "hold", undefined]),
				signal: controller.signal,
			}),
		);

		controller.abort(reason);

		await expect(response).rejects.toBe(reason);
	});

	it("rejects an oversized request before protocol dispatch", async () => {
		const add = vi.fn();
		const server = createHandler<{ requests: { add(value: number): number } }>(
			{ requests: { add } },
			{ maximumMessageLength: 8 },
		);
		const response = await server(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: binaryContentType, "Content-Type": binaryContentType },
				body: serialize([protocol, "request", 1, "add", 1]),
			}),
		);

		expect(response.status).toBe(413);
		expect(add).not.toHaveBeenCalled();
	});

	it("surfaces remote close records for requests and subscriptions", async () => {
		const record = { name: "ServerClosedError", message: "maintenance" };
		const requestClient = connect<TestProtocol>("https://example.test/realtime", {
			fetch: async () =>
				new Response(serialize([protocol, "close", record]), {
					headers: { "Content-Type": binaryContentType },
				}),
		});

		await expect(requestClient.request("identity")).rejects.toMatchObject(record);

		const subscriptionClient = connect<TestProtocol>("https://example.test/realtime", {
			fetch: async () =>
				new Response(
					new Uint8Array(encodeServerSentEvent(encodeBase64(serialize([protocol, "close", record])))),
					{
						headers: { "Content-Type": eventStreamContentType },
					},
				),
		});
		const failed = Promise.withResolvers<Error>();

		subscriptionClient.subscribe("numbers", 1, () => undefined, { onError: failed.resolve });

		await expect(failed.promise).resolves.toMatchObject(record);
	});

	it("reports a subscription stream that ends without protocol settlement", async () => {
		const client = connect<TestProtocol>("https://example.test/realtime", {
			fetch: async () => new Response(new Uint8Array(), { headers: { "Content-Type": eventStreamContentType } }),
		});
		const failed = Promise.withResolvers<Error>();

		client.subscribe("numbers", 1, () => undefined, { onError: failed.resolve });

		await expect(failed.promise).resolves.toMatchObject({
			name: "ProtocolError",
			message: "The event stream ended before completion",
		});
	});
});
