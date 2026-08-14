/// <reference lib="esnext.disposable" />

import { afterEach, describe, expect, it, vi } from "vitest";
import { connect, type WorkerOperation } from "../src/client-messaging.js";
import { listen, type ProtocolType } from "../src/lib/scope/worker.js";

type TestProtocol = {
	requests: { echo: WorkerOperation<string, string> };
	subscriptions: Record<never, never>;
};

describe("worker scope", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("listens for shared-worker connections", async () => {
		let onConnect: ((event: MessageEvent) => void) | undefined;
		const removeEventListener = vi.fn();
		const addEventListener = vi.fn((type: string, listener: (event: MessageEvent) => void) => {
			if (type === "connect") {
				onConnect = listener;
			}
		});
		vi.stubGlobal("onconnect", null);
		vi.stubGlobal("addEventListener", addEventListener);
		vi.stubGlobal("removeEventListener", removeEventListener);

		const servers = listen<TestProtocol>({
			requests: { echo: (value) => value },
			subscriptions: {},
		});
		const { port1, port2 } = new MessageChannel();
		const client = connect<ProtocolType<typeof servers>>(port1);

		try {
			expect(addEventListener).toHaveBeenCalledWith("connect", expect.any(Function));

			onConnect?.({ ports: [port2] } as unknown as MessageEvent);

			expect(await client.request("echo", "ready")).toBe("ready");
			expect(servers).toHaveLength(1);
		} finally {
			client.close();
			servers.close();
			expect(servers).toHaveLength(0);
			expect(removeEventListener).toHaveBeenCalledWith("connect", onConnect);

			port1.close();
			port2.close();
		}
	});

	it("serves a dedicated-worker scope directly", async () => {
		const { port1, port2 } = new MessageChannel();

		vi.stubGlobal("postMessage", port2.postMessage.bind(port2));
		vi.stubGlobal("addEventListener", port2.addEventListener.bind(port2));
		vi.stubGlobal("removeEventListener", port2.removeEventListener.bind(port2));
		vi.stubGlobal("start", port2.start.bind(port2));

		const servers = listen<TestProtocol>({
			requests: { echo: (value) => value },
			subscriptions: {},
		});
		const client = connect<ProtocolType<typeof servers>>(port1);

		try {
			expect(servers).toHaveLength(1);
			expect(await client.request("echo", "ready")).toBe("ready");
		} finally {
			client.close();
			servers.close();
			expect(servers).toHaveLength(0);
			port1.close();
			port2.close();
		}
	});
});
