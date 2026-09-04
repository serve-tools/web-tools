import { createHandler } from "@serve-tools/server-event-source";

type Tick = { value: number };

export function createReplayFeed(): {
	fetch: (lastEventId?: string) => Promise<Response>;
	send: (value: number) => void;
	close: () => void;
} {
	const history: Tick[] = [];
	const handler = createHandler<{ tick: Tick }>({
		connect(connection) {
			const index = history.findIndex((tick) => String(tick.value) === connection.lastEventId);
			if (index >= 0) {
				for (const tick of history.slice(index + 1)) {
					connection.send("tick", tick, { id: String(tick.value) });
				}
			}
		},
	});

	return {
		fetch(lastEventId?: string): Promise<Response> {
			const headers = typeof lastEventId === "string" ? { "Last-Event-ID": lastEventId } : undefined;
			return handler(new Request("https://feed.invalid/events", { headers }));
		},
		send(value: number): void {
			if (typeof value !== "number" || !Number.isFinite(value)) {
				throw new TypeError("value must be finite");
			}
			const tick = { value };
			history.push(tick);
			handler.send("tick", tick, { id: String(value) });
		},
		close: () => handler.close(),
	};
}
