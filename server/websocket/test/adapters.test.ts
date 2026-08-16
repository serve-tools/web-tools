import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import type { Message, Peer } from "crossws";
import { describe, expect, it, vi } from "vitest";

import { createHooks } from "../src/crossws.js";
import type { BunWebSocketLike } from "../src/scope/bun.js";
import { createBunAdapter } from "../src/scope/bun.js";

const tick = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

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
		const response = await adapter.upgrade(new Request("https://example.test/socket"), {
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
		const response = await adapter.upgrade(new Request("https://example.test/socket"), { upgrade });

		expect(response?.status).toBe(403);
		expect(upgrade).not.toHaveBeenCalled();
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
		const upgrade = await hooks.upgrade?.(new Request("https://example.test/socket"));
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
});
