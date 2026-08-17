import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import type { Message, Peer } from "crossws";
import { describe, expect, it, vi } from "vitest";

import { createHooks } from "../src/crossws.js";
import type { BunWebSocketLike } from "../src/runtime/bun.js";
import { createBunAdapter } from "../src/runtime/bun.js";

const tick = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

const upgradeRequest = (): Request =>
	new Request("https://example.test/socket", { headers: { "Sec-WebSocket-Protocol": subprotocol } });

describe("runtime adapters", () => {
	it("authorizes and maps Bun callbacks", async () => {
		interface Protocol {
			requests: { whoami(): string };
		}

		const adapter = createBunAdapter<Protocol, { user: string }>(
			{
				requests: {
					whoami: (_input: undefined, { connection }: { connection: { user: string } }) => connection.user,
				},
			},
			{ authorize: () => ({ user: "ada" }) },
		);

		let data: Parameters<typeof adapter.websocket.open>[0]["data"] | undefined;

		const response = await adapter.upgrade(upgradeRequest(), {
			upgrade(_request, options) {
				data = options.data;

				return true;
			},
		});
		const sent: ArrayBuffer[] = [];
		const socket = {
			data: data!,
			send: (payload: ArrayBuffer) => void sent.push(payload),
			getBufferedAmount: () => 0,
			close: vi.fn(),
		} satisfies BunWebSocketLike<typeof data> as never;

		expect(response).toBeUndefined();

		adapter.websocket.open(socket);
		adapter.websocket.message(socket, serialize([protocol, "request", 1, "whoami", undefined]));

		await tick();

		expect(sent.map((payload) => deserialize(payload))).toEqual([[protocol, "resolve", 1, "ada"]]);
	});

	it("returns authorization responses before Bun upgrade", async () => {
		interface Protocol {
			requests: { ping(): string };
		}

		const upgrade = vi.fn();
		const adapter = createBunAdapter<Protocol>(
			{ requests: { ping: () => "pong" } },
			{ authorize: () => new Response("Forbidden", { status: 403 }) },
		);
		const response = await adapter.upgrade(upgradeRequest(), { upgrade });

		expect(response?.status).toBe(403);
		expect(upgrade).not.toHaveBeenCalled();
	});

	it("reports Bun text messages as explicit protocol failures", () => {
		interface Protocol {
			requests: { ping(): string };
		}

		const adapter = createBunAdapter<Protocol>({ requests: { ping: () => "pong" } });
		const sent: ArrayBuffer[] = [];
		const socket = {
			data: { context: undefined },
			send: (payload: ArrayBuffer) => void sent.push(payload),
			getBufferedAmount: () => 0,
			close: vi.fn(),
		} satisfies BunWebSocketLike<{ context: undefined }>;

		adapter.websocket.open(socket);
		adapter.websocket.message(socket, "text");

		expect(sent.map((payload) => deserialize(payload))).toEqual([
			[
				protocol,
				"close",
				expect.objectContaining({ name: "ProtocolError", message: "Expected a binary WebSocket message" }),
			],
		]);
		expect(socket.close).toHaveBeenCalledWith(1002, "Protocol error");
	});

	it("accepts Bun backpressure and fails only dropped outgoing messages", async () => {
		interface Protocol {
			requests: { ping(): string };
		}

		for (const [result, closes] of [
			[-1, []],
			[0, [[1011, "Transport failure"]]],
		] as const) {
			const adapter = createBunAdapter<Protocol>({ requests: { ping: () => "pong" } });
			const close = vi.fn();
			const socket = {
				data: { context: undefined },
				send: () => result,
				getBufferedAmount: () => 0,
				close,
			} satisfies BunWebSocketLike<{ context: undefined }>;

			adapter.websocket.open(socket);
			adapter.websocket.message(socket, serialize([protocol, "request", 1, "ping", undefined]));
			await tick();

			expect(close.mock.calls).toEqual(closes);
		}
	});

	it("maps crossws upgrade context and message hooks", async () => {
		interface Protocol {
			requests: { whoami(): string };
		}

		const hooks = createHooks<Protocol, { user: string }>(
			{
				requests: {
					whoami: (_input: undefined, { connection }: { connection: { user: string } }) => connection.user,
				},
			},
			{ authorize: () => ({ user: "grace" }) },
		);
		const upgrade = await hooks.upgrade?.(upgradeRequest());
		const sent: ArrayBuffer[] = [];
		const peer = {
			context: (upgrade as { context: Record<string, unknown> }).context,
			send: (payload: ArrayBuffer) => void sent.push(payload),
			close: vi.fn(),
		} as unknown as Peer;

		await hooks.open?.(peer);
		await hooks.message?.(peer, {
			rawData: new Uint8Array(serialize([protocol, "request", 1, "whoami", undefined])),
			uint8Array: () => new Uint8Array(serialize([protocol, "request", 1, "whoami", undefined])),
		} as Message);
		await tick();

		expect(sent.map((payload) => deserialize(payload))).toEqual([[protocol, "resolve", 1, "grace"]]);

		hooks.closeConnections("done");

		expect(peer.close).toHaveBeenCalledWith(1000, "");
	});

	it("rejects crossws authorization and open callbacks that finish after shutdown", async () => {
		interface Protocol {
			requests: { ping(): string };
		}

		const authorization = Promise.withResolvers<undefined>();
		const hooks = createHooks<Protocol>(
			{ requests: { ping: () => "pong" } },
			{ authorize: () => authorization.promise },
		);
		const upgrade = hooks.upgrade?.(upgradeRequest());

		hooks.closeConnections();
		authorization.resolve(undefined);

		const rejection = await upgrade;

		expect(rejection).toBeInstanceOf(Response);
		expect((rejection as Response).status).toBe(503);

		const peer = { context: {}, close: vi.fn() } as unknown as Peer;

		await hooks.open?.(peer);

		expect(peer.close).toHaveBeenCalledWith(1001, "Server closing");
	});

	it("reports crossws text messages as explicit protocol failures", async () => {
		interface Protocol {
			requests: { ping(): string };
		}

		const hooks = createHooks<Protocol>({ requests: { ping: () => "pong" } });
		const upgrade = await hooks.upgrade?.(upgradeRequest());
		const sent: ArrayBuffer[] = [];
		const peer = {
			context: (upgrade as { context: Record<string, unknown> }).context,
			send: (payload: ArrayBuffer) => void sent.push(payload),
			close: vi.fn(),
		} as unknown as Peer;

		await hooks.open?.(peer);
		await hooks.message?.(peer, { rawData: "text" } as Message);

		expect(sent.map((payload) => deserialize(payload))).toEqual([
			[
				protocol,
				"close",
				expect.objectContaining({ name: "ProtocolError", message: "Expected a binary WebSocket message" }),
			],
		]);
		expect(peer.close).toHaveBeenCalledWith(1002, "Protocol error");
	});
});
