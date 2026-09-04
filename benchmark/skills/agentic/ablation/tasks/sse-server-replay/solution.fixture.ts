import { createHandler } from "@serve-tools/server-event-source";

type Tick = { value: number };

export function createReplayFeed(): {
	fetch(lastEventId?: string): Promise<Response>;
	send(value: number): void;
	close(): void;
} {
	const history: Tick[] = [];
	const handler = createHandler<{ tick: Tick; message: Tick }>({
		connect(connection) {
			const index = history.findIndex(({ value }) => String(value) === connection.lastEventId);

			if (index < 0) {
				return;
			}

			for (const tick of history.slice(index + 1)) {
				connection.send("tick", tick, { id: String(tick.value) });
			}
		},
	});

	return {
		async fetch(lastEventId) {
			const headers = new Headers();

			if (lastEventId !== undefined) {
				headers.set("Last-Event-ID", lastEventId);
			}

			return handler(new Request("https://local/events", { headers }));
		},
		send(value) {
			if (!Number.isFinite(value)) {
				throw new TypeError("Expected a finite tick");
			}

			const tick = { value };

			history.push(tick);
			handler.send("tick", tick, { id: String(value) });
		},
		close: () => handler.close(),
	};
}
