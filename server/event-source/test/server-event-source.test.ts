import { expect, test, vi } from "vitest";
import { createHandler } from "../src/server-event-source.js";

test("streams named JSON events with IDs", async () => {
	const handler = createHandler<{ presence: { online: number }; message: string }>({
		connect(connection) {
			expect(connection.lastEventId).toBe("event-40");
			connection.send("presence", { online: 2 }, { id: "event-41" });
			connection.send("message", "ready", { id: "event-42" });
			connection.close();
		},
	});
	const response = await handler(
		new Request("https://example.test/events", { headers: { "Last-Event-ID": "event-40" } }),
	);

	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("text/event-stream");
	expect(await response.text()).toBe(
		'event: presence\nid: event-41\ndata: {"online":2}\n\nid: event-42\ndata: "ready"\n\n',
	);
});

test("broadcasts comments, retry fields, and events", async () => {
	const handler = createHandler<{ count: number }>();
	const response = await handler(new Request("https://example.test/events"));

	expect(handler.size).toBe(1);
	handler.comment("keepalive");
	handler.retry(1500);
	handler.send("count", 3, { id: "3" });
	handler.close();

	expect(await response.text()).toBe(": keepalive\n\nretry: 1500\n\nevent: count\nid: 3\ndata: 3\n\n");
	expect(handler.size).toBe(0);
});

test("authorizes before opening the stream and supports 204 to stop reconnection", async () => {
	const connect = vi.fn();
	const handler = createHandler<{ message: null }, { user: string }>({
		authorize: () => new Response(null, { status: 204 }),
		connect,
	});
	const response = await handler(new Request("https://example.test/events"));

	expect(response.status).toBe(204);
	expect(connect).not.toHaveBeenCalled();
});

test("includes custom response headers from Headers and header tuples", async () => {
	const headers = new Headers({
		"Access-Control-Allow-Origin": "https://app.example.test",
		"X-Stream-Policy": "live",
	});
	const handler = createHandler({ headers });
	const response = await handler(new Request("https://example.test/events"));

	expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.test");
	expect(response.headers.get("x-stream-policy")).toBe("live");
	handler.close();

	const tupleHandler = createHandler({ headers: [["Access-Control-Expose-Headers", "Last-Event-ID"]] });
	const tupleResponse = await tupleHandler(new Request("https://example.test/events"));

	expect(tupleResponse.headers.get("access-control-expose-headers")).toBe("Last-Event-ID");
	tupleHandler.close();
});

test("keeps required event stream and proxy-safety response headers authoritative", async () => {
	const handler = createHandler({
		headers: [
			["Cache-Control", "public, max-age=31536000"],
			["Content-Type", "application/json"],
			["X-Accel-Buffering", "yes"],
		],
	});
	const response = await handler(new Request("https://example.test/events"));

	expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
	expect(response.headers.get("content-type")).toBe("text/event-stream");
	expect(response.headers.get("x-accel-buffering")).toBe("no");
	handler.close();
});

test("returns authorization responses unchanged", async () => {
	const handler = createHandler({
		headers: { "Access-Control-Allow-Origin": "https://app.example.test" },
		authorize: () => new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } }),
	});
	const response = await handler(new Request("https://example.test/events"));

	expect(response.status).toBe(401);
	expect(response.headers.get("www-authenticate")).toBe("Bearer");
	expect(response.headers.has("access-control-allow-origin")).toBe(false);
});

test("rejects invalid IDs and retry values", async () => {
	const handler = createHandler<{ message: string }>();
	await handler(new Request("https://example.test/events"));

	expect(() => handler.send("message", "bad", { id: "line\nbreak" })).toThrow(TypeError);
	expect(() => handler.retry(-1)).toThrow(RangeError);
	handler.close();
});

test("fails only a slow connection before its queue exceeds the configured maximum", async () => {
	const cleanups: ReturnType<typeof vi.fn>[] = [];
	const handler = createHandler<{ count: number }>({
		maximumBufferedAmount: 32,
		connect: () => {
			const cleanup = vi.fn();

			cleanups.push(cleanup);

			return cleanup;
		},
	});
	const slowResponse = await handler(new Request("https://example.test/events"));
	const fastResponse = await handler(new Request("https://example.test/events"));
	const fastReader = fastResponse.body!.getReader();
	const firstFastRead = fastReader.read();

	handler.send("count", 1);
	await expect(firstFastRead).resolves.toMatchObject({ done: false });

	const secondFastRead = fastReader.read();

	handler.send("count", 2);
	await expect(secondFastRead).resolves.toMatchObject({ done: false });

	expect(handler.size).toBe(1);
	expect(cleanups[0]).toHaveBeenCalledOnce();
	expect(cleanups[1]).not.toHaveBeenCalled();
	await expect(slowResponse.text()).rejects.toMatchObject({ name: "BackpressureError" });

	handler.close();

	await expect(fastReader.read()).resolves.toEqual({ done: true, value: undefined });
	expect(cleanups[1]).toHaveBeenCalledOnce();
});

test("does not authorize or register an already-aborted request", async () => {
	const authorize = vi.fn();
	const connect = vi.fn();
	const controller = new AbortController();
	const handler = createHandler({ authorize, connect });
	const reason = new Error("gone");

	controller.abort(reason);

	const response = handler(new Request("https://example.test/events", { signal: controller.signal }));

	await expect(response).rejects.toBe(reason);
	expect(authorize).not.toHaveBeenCalled();
	expect(connect).not.toHaveBeenCalled();
	expect(handler.size).toBe(0);
});

test("does not register a request aborted while authorization is pending", async () => {
	const authorized = Promise.withResolvers<undefined>();
	const connect = vi.fn();
	const controller = new AbortController();
	const handler = createHandler({ authorize: () => authorized.promise, connect });
	const response = handler(new Request("https://example.test/events", { signal: controller.signal }));
	const reason = new Error("gone");

	controller.abort(reason);
	authorized.resolve(undefined);

	await expect(response).rejects.toBe(reason);
	expect(connect).not.toHaveBeenCalled();
	expect(handler.size).toBe(0);
});

test("rejects invalid queue limits", () => {
	expect(() => createHandler({ maximumBufferedAmount: 0 })).toThrow(RangeError);
});
