import { afterEach, expect, test, vi } from "vitest";
import { connect } from "../src/client-event-source.js";

class TestEventSource extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSED = 2;
	readonly url: string;
	readonly withCredentials: boolean;
	readyState = TestEventSource.CONNECTING;

	constructor(url: string | URL, options?: EventSourceInit) {
		super();
		this.url = String(url);
		this.withCredentials = options?.withCredentials ?? false;
	}

	close(): void {
		this.readyState = TestEventSource.CLOSED;
	}
}

afterEach(() => vi.unstubAllGlobals());

test("parses named JSON events and preserves their IDs", () => {
	vi.stubGlobal("EventSource", TestEventSource);
	const client = connect<{ presence: { online: number } }>("https://example.test/events");
	const received: unknown[] = [];

	client.subscribe("presence", (event) => received.push(event));
	client.source.dispatchEvent(
		new MessageEvent("presence", {
			data: JSON.stringify({ online: 3 }),
			lastEventId: "event-42",
			origin: "https://example.test",
		}),
	);

	expect(received).toEqual([
		{
			type: "presence",
			data: { online: 3 },
			lastEventId: "event-42",
			origin: "https://example.test",
		},
	]);
	client.close();
});

test("reports malformed JSON and keeps the subscription active", () => {
	vi.stubGlobal("EventSource", TestEventSource);
	const report = vi.fn();
	vi.stubGlobal("reportError", report);
	const client = connect<{ message: string }>("https://example.test/events");
	const subscription = client.subscribe("message", () => undefined);

	client.source.dispatchEvent(new MessageEvent("message", { data: "not-json" }));

	expect(report).toHaveBeenCalledOnce();
	expect(subscription.active).toBe(true);
	client.close();
});

test("closes from its lifetime signal", async () => {
	vi.stubGlobal("EventSource", TestEventSource);
	const controller = new AbortController();
	const client = connect<{ message: null }>("https://example.test/events", { signal: controller.signal });

	controller.abort();

	await expect(client.closed).resolves.toBeUndefined();
	expect(client.source.readyState).toBe(EventSource.CLOSED);
});

test("closes subscriptions when the native EventSource fails permanently", async () => {
	vi.stubGlobal("EventSource", TestEventSource);
	const client = connect<{ message: null }>("https://example.test/events");
	const subscription = client.subscribe("message", () => undefined);

	(client.source as TestEventSource).readyState = EventSource.CLOSED;
	client.source.dispatchEvent(new Event("error"));

	await expect(client.closed).resolves.toBeUndefined();
	expect(subscription.active).toBe(false);
});
