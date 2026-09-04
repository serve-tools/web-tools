import { assert, loadSolution } from "../_shared.mjs";

class FakeEventSource extends EventTarget {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 2;
	static instances = [];
	CONNECTING = 0;
	OPEN = 1;
	CLOSED = 2;
	readyState = 1;

	constructor() {
		super();
		FakeEventSource.instances.push(this);
	}

	close() {
		this.readyState = 2;
	}
}

const savedSource = globalThis.EventSource;
const savedReport = globalThis.reportError;
const reported = [];

globalThis.EventSource = FakeEventSource;
globalThis.reportError = (error) => reported.push(error);

try {
	const { connectStatus } = await loadSolution();
	const controller = new AbortController();
	const result = connectStatus(new URL("https://x/status"), controller.signal);
	const source = FakeEventSource.instances[0];

	for (const [lastEventId, data] of [
		["a", '{"state":"one"}'],
		["b", "bad"],
	]) {
		source.dispatchEvent(Object.assign(new Event("status"), { data, lastEventId, origin: "x" }));
	}

	assert.deepEqual(result.states, ["a:one"]);
	assert.equal(reported.length, 1);

	controller.abort();
	assert.equal(source.readyState, FakeEventSource.CLOSED);
	await result.closed;

	source.dispatchEvent(
		Object.assign(new Event("status"), { data: '{"state":"late"}', lastEventId: "c", origin: "x" }),
	);
	assert.deepEqual(result.states, ["a:one"]);

	const manual = connectStatus("https://x/manual");
	const manualSource = FakeEventSource.instances[1];

	manual.close();
	manual.close();
	await manual.closed;
	assert.equal(manualSource.readyState, FakeEventSource.CLOSED);
	assert.throws(() => connectStatus("https://x", {}), TypeError);
} finally {
	globalThis.EventSource = savedSource;
	globalThis.reportError = savedReport;
}
