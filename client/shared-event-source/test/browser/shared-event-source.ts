/// <reference lib="webworker" />

import { listen } from "../../src/lib/scope/shared-worker.js";

class LoopbackEventSource extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	static count = 0;
	readonly CONNECTING = LoopbackEventSource.CONNECTING;
	readonly OPEN = LoopbackEventSource.OPEN;
	readonly CLOSED = LoopbackEventSource.CLOSED;
	readyState = LoopbackEventSource.OPEN;
	#sequence = 0;
	#timer: number;

	constructor() {
		super();
		++LoopbackEventSource.count;
		this.#timer = setInterval(() => {
			if (this.readyState === LoopbackEventSource.CLOSED) {
				return;
			}

			++this.#sequence;
			this.dispatchEvent(
				new MessageEvent("presence", {
					data: JSON.stringify({ sequence: this.#sequence, sourceCount: LoopbackEventSource.count }),
					lastEventId: String(this.#sequence),
					origin: "https://loopback.test",
				}),
			);
		}, 100) as unknown as number;
	}

	close(): void {
		if (this.readyState === LoopbackEventSource.CLOSED) {
			return;
		}

		this.readyState = LoopbackEventSource.CLOSED;
		clearInterval(this.#timer);
	}
}

Object.assign(globalThis, { EventSource: LoopbackEventSource });

const server = listen<{
	presence: { sequence: number; sourceCount: number };
}>("https://loopback.test/events");

export type TestEvents = listen.EventMapType<typeof server>;
