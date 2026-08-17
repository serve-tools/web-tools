import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { contentType, streamContentType } from "@serve-tools/realtime-protocol/http-stream";
import { describe, expect, it } from "vitest";

import { createHandler } from "../src/server-http-stream.js";

describe("createHandler", () => {
	it("serves a finite request through the realtime core", async () => {
		const handler = createHandler<{ requests: { double(value: number): number } }>({
			requests: { double: (value) => value * 2 },
		});
		const response = await handler(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: contentType, "Content-Type": contentType },
				body: serialize([protocol, "request", 1, "double", 4]),
			}),
		);

		expect(response.status).toBe(200);
		expect(deserialize(await response.arrayBuffer())).toEqual([protocol, "resolve", 1, 8]);
	});

	it("serves a subscription as a framed stream representation", async () => {
		const handler = createHandler<{ subscriptions: { count(): number } }>({
			subscriptions: {
				count: (_input, { emit, complete }) => {
					emit(1);
					complete();
				},
			},
		});
		const response = await handler(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: streamContentType, "Content-Type": contentType },
				body: serialize([protocol, "subscribe", 1, "count", undefined]),
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(streamContentType);
	});
});
