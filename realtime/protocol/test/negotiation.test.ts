import { describe, expect, it } from "vitest";
import {
	offersWebSocketSubprotocol,
	offersWebTransportSubprotocol,
	subprotocol,
	webTransportDatagramRegistryRole,
	webTransportOperationsRole,
} from "../src/realtime-protocol.js";

describe("transport negotiation", () => {
	it("matches WebSocket token lists", () => {
		expect(offersWebSocketSubprotocol(`chat, ${subprotocol}`)).toBe(true);
		expect(offersWebSocketSubprotocol(["chat", subprotocol])).toBe(true);
		expect(offersWebSocketSubprotocol(`chat, ${subprotocol}.other`)).toBe(false);
	});

	it("matches WebTransport Structured Fields string lists", () => {
		expect(offersWebTransportSubprotocol(`"chat", "${subprotocol}"`)).toBe(true);
		expect(offersWebTransportSubprotocol([`"chat"`, `"${subprotocol}"`])).toBe(true);
		expect(offersWebTransportSubprotocol(`"chat"; note="${subprotocol}"`)).toBe(false);
		expect(offersWebTransportSubprotocol(`"${subprotocol}", invalid`)).toBe(false);
		expect(offersWebTransportSubprotocol(subprotocol)).toBe(false);
	});

	it("publishes stable WebTransport stream roles", () => {
		expect(webTransportOperationsRole).toBe(0);
		expect(webTransportDatagramRegistryRole).toBe(1);
	});
});
