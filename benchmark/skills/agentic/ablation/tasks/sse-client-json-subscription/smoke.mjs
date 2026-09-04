import { assert, loadSolution } from "../_shared.mjs";

class FakeEventSource extends EventTarget {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 2;
	static last;
	CONNECTING = 0;
	OPEN = 1;
	CLOSED = 2;
	readyState = 1;

	constructor() {
		super();
		FakeEventSource.last = this;
	}

	close() {
		this.readyState = 2;
	}
}

const saved = globalThis.EventSource;

globalThis.EventSource = FakeEventSource;

try {
	const { connectStatus } = await loadSolution();
	const result = connectStatus("https://x");

	FakeEventSource.last.dispatchEvent(
		Object.assign(new Event("status"), { data: '{"state":"up"}', lastEventId: "1", origin: "x" }),
	);

	assert.deepEqual(result.states, ["1:up"]);
	result.close();
	await result.closed;
	assert.equal(FakeEventSource.last.readyState, FakeEventSource.CLOSED);
} finally {
	globalThis.EventSource = saved;
}
