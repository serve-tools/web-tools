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

test("rejects invalid IDs and retry values", async () => {
	const handler = createHandler<{ message: string }>();
	await handler(new Request("https://example.test/events"));

	expect(() => handler.send("message", "bad", { id: "line\nbreak" })).toThrow(TypeError);
	expect(() => handler.retry(-1)).toThrow(RangeError);
	handler.close();
});
