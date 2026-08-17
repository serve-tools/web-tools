import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { decodeDatagram, encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { DatagramRegistry } from "@serve-tools/realtime-protocol/datagram-registry";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import { describe, expect, it, vi } from "vitest";

import { createSession } from "../src/server-webtransport.js";

interface TestProtocol {
	requests: { ping(value: string): string };
	datagrams: {
		cursor: { client: { x: number; y: number } };
		presence: { server: { online: boolean } };
	};
}

describe("WebTransport session core", () => {
	it("shares reliable operations and typed best-effort datagrams", async () => {
		const operationWrites: Uint8Array[] = [];
		const datagramWrites: Uint8Array[] = [];
		const cursor = vi.fn();
		let session!: ReturnType<typeof createSession<TestProtocol>>;
		const clientRegistry = new DatagramRegistry((payload) => session.receiveRegistry(payload));

		session = createSession<TestProtocol>(
			{
				requests: { ping: (value) => `${value}!` },
				datagrams: { cursor: (value) => void cursor(value) },
			},
			{
				sendOperations: (payload) => operationWrites.push(payload),
				sendRegistry: (payload) => clientRegistry.receive(payload),
				sendDatagram: (payload) => void datagramWrites.push(payload),
				close: vi.fn(),
				maxDatagramSize: 1_200,
			},
			undefined,
		);

		session.receiveOperations(encodeFrame(serialize([protocol, "request", 1, "ping", "hello"])));
		await Promise.resolve();
		await Promise.resolve();

		const operationDecoder = new FrameDecoder();
		expect(
			operationWrites.flatMap((chunk) => operationDecoder.push(chunk)).map((frame) => deserialize(frame)),
		).toEqual([[protocol, "resolve", 1, "hello!"]]);
		expect(session.datagrams.maxDatagramSize).toBe(1_200);

		const cursorKind = await clientRegistry.register("cursor");
		session.receiveDatagram(encodeDatagram(cursorKind, { x: 3, y: 8 }));
		await Promise.resolve();
		expect(cursor).toHaveBeenCalledWith({ x: 3, y: 8 });

		await session.datagrams.write("presence", { online: true });
		const presence = decodeDatagram(datagramWrites[0]!);

		expect(clientRegistry.name(presence.kind)).toBe("presence");
		expect(presence.value).toEqual({ online: true });
	});
});
