import { expect, test } from "vitest";
import * as clientSignals from "../src/client-signals.js";

test("exposes each signal-aware client namespace", () => {
	expect(Object.keys(clientSignals).sort()).toEqual([
		"db",
		"dom",
		"eventTarget",
		"httpStream",
		"messaging",
		"sharedDb",
		"sharedHttpStream",
		"sharedWebsocket",
		"sharedWebtransport",
		"storage",
		"websocket",
		"webtransport",
	]);
});
