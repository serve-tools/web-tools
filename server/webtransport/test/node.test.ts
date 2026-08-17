import { subprotocol } from "@serve-tools/realtime-protocol";
import { describe, expect, it, vi } from "vitest";
import type { NodeWebTransportSessionLike } from "../src/runtime/node.js";
import { createNodeAdapter } from "../src/runtime/node.js";

interface Protocol {
	requests: { ping(): string };
}

const nativeSession = (protocols?: string): NodeWebTransportSessionLike => ({
	headers: protocols === undefined ? {} : { "wt-available-protocols": protocols },
	path: "/realtime",
	sendDatagram: vi.fn(() => true),
});

describe("Node WebTransport adapter", () => {
	it("requires and selects the native application protocol", async () => {
		const adapter = createNodeAdapter<Protocol>({ requests: { ping: () => "pong" } });

		await expect(adapter.session(nativeSession())).resolves.toMatchObject({ status: 400 });

		const response = await adapter.session(nativeSession(`"${subprotocol}"`));

		expect(response).toBeInstanceOf(Response);
		expect((response as Response).status).toBe(200);
		expect((response as Response).headers.get("WT-Protocol")).toBe(JSON.stringify(subprotocol));
	});

	it("rejects authorization that finishes after shutdown", async () => {
		const authorization = Promise.withResolvers<undefined>();
		const adapter = createNodeAdapter<Protocol>(
			{ requests: { ping: () => "pong" } },
			{ authorize: () => authorization.promise },
		);
		const pending = adapter.session(nativeSession(`"${subprotocol}"`));

		adapter.close();
		authorization.resolve(undefined);

		await expect(pending).resolves.toMatchObject({ status: 503 });
	});
});
