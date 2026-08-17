import { protocol, serialize } from "@serve-tools/realtime-protocol";
import { contentType, streamContentType } from "@serve-tools/realtime-protocol/http-stream";
import { encodeFrame } from "@serve-tools/realtime-protocol/stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "../../../server/http-stream/src/server-http-stream.js";
import { connect } from "../src/client-http-stream.js";

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

describe("HTTP stream conformance", () => {
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

	it("selects a finite representation when Accept lists multiple representations", async () => {
		const server = createHandler<TestProtocol, { user: string }>(handlers, {
			authorize: () => ({ user: "test" }),
		});
		const response = await server(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: {
					Accept: `application/json, ${contentType}`,
					"Content-Type": contentType,
				},
				body: serialize([protocol, "request", 1, "add", { a: 3, b: 4 }]),
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(contentType);
	});

	it("rejects a representation excluded with q=0", async () => {
		const server = createHandler<TestProtocol, { user: string }>(handlers, {
			authorize: () => ({ user: "test" }),
		});
		const response = await server(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: `${contentType};q=0`, "Content-Type": contentType },
				body: serialize([protocol, "request", 1, "identity", undefined]),
			}),
		);

		expect(response.status).toBe(406);
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
				headers: { Accept: contentType, "Content-Type": contentType },
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
				headers: { Accept: contentType, "Content-Type": contentType },
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
					headers: { "Content-Type": contentType },
				}),
		});

		await expect(requestClient.request("identity")).rejects.toMatchObject(record);

		const subscriptionClient = connect<TestProtocol>("https://example.test/realtime", {
			fetch: async () =>
				new Response(encodeFrame(serialize([protocol, "close", record])), {
					headers: { "Content-Type": streamContentType },
				}),
		});
		const failed = Promise.withResolvers<Error>();

		subscriptionClient.subscribe("numbers", 1, () => undefined, { onError: failed.resolve });

		await expect(failed.promise).resolves.toMatchObject(record);
	});

	it("decodes subscription frames split across response chunks", async () => {
		const event = encodeFrame(serialize([protocol, "event", 1, 7]));
		const complete = encodeFrame(serialize([protocol, "complete", 1]));
		const bytes = new Uint8Array(event.byteLength + complete.byteLength);

		bytes.set(event);
		bytes.set(complete, event.byteLength);

		const client = connect<TestProtocol>("https://example.test/realtime", {
			fetch: async () =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(bytes.subarray(0, 2));
							controller.enqueue(bytes.subarray(2, event.byteLength + 3));
							controller.enqueue(bytes.subarray(event.byteLength + 3));
							controller.close();
						},
					}),
					{ headers: { "Content-Type": streamContentType } },
				),
		});
		const completed = Promise.withResolvers<void>();
		const values: number[] = [];

		client.subscribe("numbers", 1, (value) => values.push(value), {
			onComplete: completed.resolve,
			onError: completed.reject,
		});
		await completed.promise;

		expect(values).toEqual([7]);
		client.close();
	});

	it("reports a subscription stream that ends without protocol settlement", async () => {
		const client = connect<TestProtocol>("https://example.test/realtime", {
			fetch: async () => new Response(new Uint8Array(), { headers: { "Content-Type": streamContentType } }),
		});
		const failed = Promise.withResolvers<Error>();

		client.subscribe("numbers", 1, () => undefined, { onError: failed.resolve });

		await expect(failed.promise).resolves.toMatchObject({
			name: "ProtocolError",
			message: "The binary stream ended before completion",
		});
	});
});
