import { subprotocol } from "@serve-tools/realtime-protocol";
import { describe, expect, it, vi } from "vitest";
import type { NodeWebTransportSessionLike, NodeWebTransportStreamLike } from "../src/runtime/node.js";
import { createNodeAdapter } from "../src/runtime/node.js";

interface Protocol {
	requests: { ping(): string };
}

const nativeSession = (protocols?: string): NodeWebTransportSessionLike => ({
	headers: protocols === undefined ? {} : { "wt-available-protocols": protocols },
	path: "/realtime",
	sendDatagram: vi.fn(() => true),
});

const nativeStream = (session: NodeWebTransportSessionLike): NodeWebTransportStreamLike => ({
	session,
	send: vi.fn(() => true),
	close: vi.fn(() => true),
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

	it("closes and forgets every owned stream during shutdown", async () => {
		const adapter = createNodeAdapter<Protocol>({ requests: { ping: () => "pong" } });
		const session = nativeSession(`"${subprotocol}"`);

		await adapter.session(session);

		const operations = nativeStream(session);
		const registry = nativeStream(session);

		adapter.webTransportStream(operations);
		adapter.webTransportData(operations, Uint8Array.of(0));
		adapter.webTransportStream(registry);
		adapter.webTransportData(registry, Uint8Array.of(1));
		adapter.close("shutdown");

		expect(operations.close).toHaveBeenCalledOnce();
		expect(registry.close).toHaveBeenCalledOnce();
	});

	it("ends the session and its remaining streams when the registry reaches EOF", async () => {
		const adapter = createNodeAdapter<Protocol>({ requests: { ping: () => "pong" } });
		const session = nativeSession(`"${subprotocol}"`);

		await adapter.session(session);

		const operations = nativeStream(session);
		const registry = nativeStream(session);

		adapter.webTransportStream(operations);
		adapter.webTransportData(operations, Uint8Array.of(0));
		adapter.webTransportStream(registry);
		adapter.webTransportData(registry, Uint8Array.of(1));
		adapter.webTransportStreamEnd(registry, "finished");

		await vi.waitFor(() => expect(operations.close).toHaveBeenCalledOnce());

		expect(registry.close).not.toHaveBeenCalled();
	});

	it("closes only streams owned by a session that reaches EOF", async () => {
		const adapter = createNodeAdapter<Protocol>({ requests: { ping: () => "pong" } });
		const firstSession = nativeSession(`"${subprotocol}"`);
		const secondSession = nativeSession(`"${subprotocol}"`);

		await Promise.all([adapter.session(firstSession), adapter.session(secondSession)]);

		const firstOperations = nativeStream(firstSession);
		const firstRegistry = nativeStream(firstSession);
		const secondOperations = nativeStream(secondSession);
		const secondRegistry = nativeStream(secondSession);

		for (const [stream, role] of [
			[firstOperations, 0],
			[firstRegistry, 1],
			[secondOperations, 0],
			[secondRegistry, 1],
		] as const) {
			adapter.webTransportStream(stream);
			adapter.webTransportData(stream, Uint8Array.of(role));
		}

		adapter.webTransportStreamEnd(firstRegistry, "finished");

		await vi.waitFor(() => expect(firstOperations.close).toHaveBeenCalledOnce());

		expect(firstRegistry.close).not.toHaveBeenCalled();
		expect(secondOperations.close).not.toHaveBeenCalled();
		expect(secondRegistry.close).not.toHaveBeenCalled();

		adapter.close("shutdown");

		expect(secondOperations.close).toHaveBeenCalledOnce();
		expect(secondRegistry.close).toHaveBeenCalledOnce();
	});
});
