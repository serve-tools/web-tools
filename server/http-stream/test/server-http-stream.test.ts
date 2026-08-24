import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { contentType, streamContentType } from "@serve-tools/realtime-protocol/http-stream";
import { describe, expect, it, vi } from "vitest";

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
		const handler = createHandler<{ subscriptions: { count(): number } }>(
			{
				subscriptions: {
					count: (_input, { emit, complete }) => {
						emit(1);
						complete();
					},
				},
			},
			{ maximumBufferedAmount: 512 },
		);
		const response = await handler(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: streamContentType, "Content-Type": contentType },
				body: serialize([protocol, "subscribe", 1, "count", undefined]),
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(streamContentType);
		expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
	});

	it("rejects hostile resizable buffers before dispatch", async () => {
		const double = vi.fn((value: number) => value * 2);
		const handler = createHandler<{ requests: { double(value: number): number } }>(
			{ requests: { double } },
			{ maximumMessageLength: 256 },
		);
		const metadata = new TextEncoder().encode(
			JSON.stringify([
				"@serve-tools/structured-serialization/1",
				0,
				[[1, 2, 3, 4, 5], protocol, "request", 1, "double", ["A", 0, 1, 1_000_000_000]],
			]),
		);
		const payload = new Uint8Array(metadata.byteLength + 2);

		payload.set(metadata);

		const response = await handler(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: contentType, "Content-Type": contentType },
				body: payload,
			}),
		);

		expect(response.status).toBe(400);
		expect(double).not.toHaveBeenCalled();
	});

	it("fails and cleans up a subscription before its response queue exceeds the configured maximum", async () => {
		const cleanup = vi.fn();
		const handler = createHandler<{ subscriptions: { burst(): string } }>(
			{
				subscriptions: {
					burst: (_input, { emit }) => {
						emit("a".repeat(80));
						emit("b".repeat(80));

						return cleanup;
					},
				},
			},
			{ maximumBufferedAmount: 256 },
		);
		const response = await handler(
			new Request("https://example.test/realtime", {
				method: "POST",
				headers: { Accept: streamContentType, "Content-Type": contentType },
				body: serialize([protocol, "subscribe", 1, "burst", undefined]),
			}),
		);

		await expect(response.arrayBuffer()).rejects.toMatchObject({ name: "BackpressureError" });
		await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());
	});
});
