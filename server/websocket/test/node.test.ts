import { once } from "node:events";
import { createServer, request } from "node:http";
import { subprotocol } from "@serve-tools/realtime-protocol";
import { afterEach, describe, expect, it } from "vitest";
import { connect } from "../../../client/websocket/src/client-websocket.js";
import { handleUpgrade } from "../src/runtime/node.js";

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
	await Promise.all([...servers].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
	servers.clear();
});

describe("Node client/server conformance", () => {
	it("runs the real client over a real ws-backed upgrade", async () => {
		interface Protocol {
			requests: {
				add(input: { a: number; b: number }): number;
				identity(): string;
			};
			subscriptions: {
				numbers(start: number): number;
			};
		}

		const upgrade = handleUpgrade<Protocol, { user: string }>(
			{
				requests: {
					add: ({ a, b }) => a + b,
					identity: (_input, { connection }) => connection.user,
				},
				subscriptions: {
					numbers: (start, { emit, complete }) => {
						emit(start);
						emit(start + 1);
						complete();
					},
				},
			},
			{ authorize: () => ({ user: "ada" }) },
		);
		const server = createServer();

		servers.add(server);
		server.on("upgrade", upgrade);
		server.listen(0, "127.0.0.1");
		await once(server, "listening");

		const address = server.address();

		if (!address || typeof address === "string") {
			throw new Error("Expected a TCP server address");
		}

		await using client = await connect<Protocol>(`ws://127.0.0.1:${address.port}`);

		await expect(client.request("add", { a: 2, b: 3 })).resolves.toBe(5);
		await expect(client.request("identity")).resolves.toBe("ada");

		const events: number[] = [];
		const completed = Promise.withResolvers<void>();

		client.subscribe("numbers", 4, (event) => events.push(event), { onComplete: completed.resolve });
		await completed.promise;

		expect(events).toEqual([4, 5]);

		upgrade.close();
		await client.closed;
	});

	it("returns an HTTP authorization rejection before upgrading", async () => {
		interface Protocol {
			requests: { ping(): string };
		}

		const server = createServer();

		servers.add(server);
		server.on(
			"upgrade",
			handleUpgrade<Protocol>(
				{ requests: { ping: () => "pong" } },
				{
					authorize: () => new Response("Unauthorized", { status: 401 }),
				},
			),
		);
		server.listen(0, "127.0.0.1");
		await once(server, "listening");

		const address = server.address();

		if (!address || typeof address === "string") {
			throw new Error("Expected a TCP server address");
		}

		const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
			request({
				host: "127.0.0.1",
				port: address.port,
				headers: {
					connection: "Upgrade",
					"sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
					"sec-websocket-protocol": subprotocol,
					"sec-websocket-version": "13",
					upgrade: "websocket",
				},
			})
				.once("response", resolve)
				.once("error", reject)
				.end();
		});

		expect(response.statusCode).toBe(401);

		const body: Buffer[] = [];

		for await (const chunk of response) {
			body.push(chunk);
		}

		expect(Buffer.concat(body).toString()).toBe("Unauthorized");
	});

	it("rejects an upgrade whose authorization finishes after shutdown", async () => {
		interface Protocol {
			requests: { ping(): string };
		}

		const authorization = Promise.withResolvers<undefined>();
		const authorizationStarted = Promise.withResolvers<void>();
		const upgrade = handleUpgrade<Protocol>(
			{ requests: { ping: () => "pong" } },
			{
				authorize: () => {
					authorizationStarted.resolve();

					return authorization.promise;
				},
			},
		);
		const server = createServer();

		servers.add(server);
		server.on("upgrade", upgrade);
		server.listen(0, "127.0.0.1");
		await once(server, "listening");

		const address = server.address();

		if (!address || typeof address === "string") {
			throw new Error("Expected a TCP server address");
		}

		const response = new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
			request({
				host: "127.0.0.1",
				port: address.port,
				headers: {
					connection: "Upgrade",
					"sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
					"sec-websocket-protocol": subprotocol,
					"sec-websocket-version": "13",
					upgrade: "websocket",
				},
			})
				.once("response", resolve)
				.once("error", reject)
				.end();
		});

		await authorizationStarted.promise;
		upgrade.close();
		authorization.resolve(undefined);

		const rejection = await response;

		expect(rejection.statusCode).toBe(503);
		for await (const _chunk of rejection) {
			// Consume the response before closing the HTTP server.
		}
	});
});
