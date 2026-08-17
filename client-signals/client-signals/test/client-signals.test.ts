import { expect, test } from "vitest";
import * as clientSignals from "../src/client-signals.js";

test("exposes each signal-aware client namespace", () => {
	expect(Object.keys(clientSignals).sort()).toEqual([
		"db",
		"dom",
		"eventSource",
		"eventTarget",
		"httpStream",
		"messaging",
		"sharedDb",
		"sharedEventSource",
		"sharedHttpStream",
		"sharedWebsocket",
		"sharedWebtransport",
		"storage",
		"websocket",
		"webtransport",
	]);
});

test("combines realtime client creation and Signal observation", () => {
	for (const capability of [
		clientSignals.eventSource,
		clientSignals.httpStream,
		clientSignals.messaging,
		clientSignals.sharedEventSource,
		clientSignals.sharedHttpStream,
		clientSignals.sharedWebsocket,
		clientSignals.sharedWebtransport,
		clientSignals.websocket,
		clientSignals.webtransport,
	]) {
		expect(capability.connect).toBeTypeOf("function");
		expect(capability.observe).toBeTypeOf("function");
	}
});
