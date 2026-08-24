import { subprotocol } from "@serve-tools/realtime-protocol";
import { test } from "vitest";
import type { NodeWebTransportSessionLike, NodeWebTransportStreamLike } from "../src/runtime/node.js";
import { createNodeAdapter } from "../src/runtime/node.js";

interface Protocol {
	requests: { ping(): string };
}

const concurrentSessions = 1_024;
const streamsPerSession = 2;
const samples = 10;
const warmup = 3;

interface Fixture {
	readonly adapter: ReturnType<typeof createNodeAdapter<Protocol>>;
	readonly closedStreams: { value: number };
}

const createFixture = async (): Promise<Fixture> => {
	const adapter = createNodeAdapter<Protocol>({ requests: { ping: () => "pong" } });
	const closedStreams = { value: 0 };
	const sessions: NodeWebTransportSessionLike[] = [];

	for (let index = 0; index < concurrentSessions; ++index) {
		sessions.push({
			headers: { "wt-available-protocols": `"${subprotocol}"` },
			path: `/benchmark/${index}`,
			sendDatagram: () => true,
		});
	}

	await Promise.all(sessions.map((session) => adapter.session(session)));

	for (const session of sessions) {
		for (let role = 0; role < streamsPerSession; ++role) {
			const stream: NodeWebTransportStreamLike = {
				session,
				send: () => true,
				close: () => {
					++closedStreams.value;

					return true;
				},
			};

			adapter.webTransportStream(stream);
			adapter.webTransportData(stream, Uint8Array.of(role));
		}
	}

	return { adapter, closedStreams };
};

const measure = async (): Promise<number> => {
	const { adapter, closedStreams } = await createFixture();
	const start = performance.now();

	adapter.close("benchmark shutdown");

	const duration = performance.now() - start;
	const expectedClosedStreams = concurrentSessions * streamsPerSession;

	if (closedStreams.value !== expectedClosedStreams) {
		throw new Error(`Closed ${closedStreams.value} streams instead of ${expectedClosedStreams}`);
	}

	return duration;
};

test("many-session adapter teardown", async () => {
	for (let index = 0; index < warmup; ++index) {
		await measure();
	}

	const durations: number[] = [];

	for (let index = 0; index < samples; ++index) {
		durations.push(await measure());
	}

	const sorted = durations.toSorted((left, right) => left - right);
	const meanMilliseconds = durations.reduce((total, duration) => total + duration, 0) / samples;
	const medianMilliseconds = sorted[Math.ceil(samples * 0.5) - 1]!;
	const p95Milliseconds = sorted[Math.ceil(samples * 0.95) - 1]!;

	console.log(
		`[benchmark] ${JSON.stringify({
			name: "server-webtransport/node-adapter-teardown-1024x2",
			iterations: 1,
			samples,
			meanMilliseconds,
			medianMilliseconds,
			p95Milliseconds,
			operationsPerSecond: 1_000 / meanMilliseconds,
		})}`,
	);
});
