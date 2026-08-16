import { describe, expect, it } from "vitest";

import { isClientMessage, isServerMessage, protocol } from "../src/realtime-protocol.js";

describe("realtime messages", () => {
	it("accepts every current client verb", () => {
		for (const message of [
			[protocol, "request", 1, "ping", undefined],
			[protocol, "subscribe", 2, "events", { room: "main" }],
			[protocol, "cancel", 2],
			[protocol, "close", { name: "Error", message: "done" }],
		]) {
			expect(isClientMessage(message)).toBe(true);
		}
	});

	it("accepts every current server verb", () => {
		for (const message of [
			[protocol, "resolve", 1, { ok: true }],
			[protocol, "reject", 2, { name: "Error", message: "failure" }],
			[protocol, "event", 3, "next"],
			[protocol, "complete", 3],
			[protocol, "close", { name: "Error", message: "done" }],
		]) {
			expect(isServerMessage(message)).toBe(true);
		}
	});

	it("rejects malformed envelopes", () => {
		for (const value of [
			null,
			[],
			["@serve-tools/websocket/1", "cancel", 1],
			[protocol, "cancel", -1],
			[protocol, "cancel", 1, "extra"],
			[protocol, "request", 1, 2, undefined],
			[protocol, "complete", 1, undefined],
			[protocol, "reject", 1, { name: "Error" }],
		]) {
			expect(isClientMessage(value)).toBe(false);
			expect(isServerMessage(value)).toBe(false);
		}
	});
});
