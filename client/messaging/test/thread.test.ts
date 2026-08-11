/// <reference lib="esnext.disposable" />

import { afterEach, describe, expect, it, vi } from "vitest";
import { connect, type WorkerHandlers, type WorkerOperation } from "../src/client-messaging.js";
import { activate } from "../src/scope/shared-worker.js";

type TestProtocol = {
	requests: {
		echo: WorkerOperation<string, string>;
	};
	subscriptions: Record<never, never>;
};

describe("shared worker thread", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("registers the connect listener on the worker global", async () => {
		let onConnect: ((event: MessageEvent) => void) | undefined;
		const addEventListener = vi.fn((type: string, listener: (event: MessageEvent) => void) => {
			if (type === "connect") {
				onConnect = listener;
			}
		});
		const handlers = {
			requests: { echo: (value) => value },
			subscriptions: {},
		} satisfies WorkerHandlers<TestProtocol>;

		vi.stubGlobal("addEventListener", addEventListener);

		const servers = activate<TestProtocol>(handlers);
		const { port1, port2 } = new MessageChannel();
		const client = connect<TestProtocol>(port1);

		try {
			expect(addEventListener).toHaveBeenCalledWith("connect", expect.any(Function));

			onConnect?.({ ports: [port2] } as unknown as MessageEvent);

			expect(await client.request("echo", "ready")).toBe("ready");
			expect(servers).toHaveLength(1);
		} finally {
			client.close();

			for (const server of servers) {
				server.close();
			}

			port1.close();
			port2.close();
		}
	});
});
