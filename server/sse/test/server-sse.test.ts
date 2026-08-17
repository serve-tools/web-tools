import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { binaryContentType } from "@serve-tools/realtime-protocol/sse";
import { describe, expect, it } from "vitest";

import { createHandler } from "../src/server-sse.js";

describe("createHandler", () => {
	it("serves a finite request through the realtime core", async () => {
		const handler = createHandler<{ requests: { double(value: number): number } }>({
			requests: { double: (value) => value * 2 },
		});
		const response = await handler(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: binaryContentType, "Content-Type": binaryContentType },
				body: serialize([protocol, "request", 1, "double", 4]),
			}),
		);

		expect(response.status).toBe(200);
		expect(deserialize(await response.arrayBuffer())).toEqual([protocol, "resolve", 1, 8]);
	});
});
