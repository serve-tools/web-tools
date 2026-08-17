import { afterEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "../../../server/sse/src/server-sse.js";
import { connect } from "../src/client-sse.js";

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
});
