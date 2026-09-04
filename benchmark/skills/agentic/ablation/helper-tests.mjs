import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const helpers = path.join(directory, "helpers");
const output = mkdtempSync(path.join(tmpdir(), "serve-tools-ablation-helpers-"));
const cleanup = () => rmSync(output, { force: true, recursive: true });

process.once("exit", cleanup);

try {
	symlinkSync(path.join(process.cwd(), "node_modules"), path.join(output, "node_modules"), "dir");
	execFileSync(
		path.join(process.cwd(), "node_modules/.bin/tsc"),
		[
			"--ignoreConfig",
			"--outDir",
			output,
			"--rootDir",
			helpers,
			"--target",
			"esnext",
			"--module",
			"nodenext",
			"--moduleResolution",
			"nodenext",
			"--strict",
			"--skipLibCheck",
			...[
				"resource-management",
				"async-operation",
				"reactive-state",
				"client-messaging",
				"router",
				"http-contract",
				"arraybuffer-base64",
				"ponyfill-observable",
				"realtime-protocol",
				"http-stream",
				"sse",
				"prioritized-task-scheduling",
			].map((name) => path.join(helpers, `${name}.ts`)),
		],
		{ stdio: "inherit" },
	);
} catch (error) {
	cleanup();
	throw error;
}

// This import inventory catches package-export and emitted-module regressions for every helper.
const helper = async (name) => import(pathToFileURL(path.join(output, `${name}.js`)));

test("helper modules emit with their public package imports", async () => {
	for (const name of [
		"resource-management",
		"async-operation",
		"reactive-state",
		"client-messaging",
		"router",
		"http-contract",
		"arraybuffer-base64",
		"ponyfill-observable",
		"realtime-protocol",
		"http-stream",
		"sse",
		"prioritized-task-scheduling",
	]) {
		await assert.doesNotReject(helper(name));
	}
});

test("cleanup, binary, protocol, stream, and scheduler helpers preserve runtime semantics", async () => {
	const { withAsyncResources } = await helper("resource-management");
	const { SuppressedError } = await import("@serve-tools/ponyfill-resource-management");
	const { encodeView } = await helper("arraybuffer-base64");
	const { roundTrip } = await helper("realtime-protocol");
	const { decodeFrames, frame } = await helper("http-stream");
	const { postTask } = await helper("prioritized-task-scheduling");
	const order = [];

	assert.equal(
		await withAsyncResources(async (defer) => {
			defer(() => order.push("first"));
			defer(() => order.push("second"));
			return 7;
		}),
		7,
	);
	assert.deepEqual(order, ["second", "first"]);
	const workError = new Error("work");
	const cleanupError = new Error("cleanup");
	await assert.rejects(
		withAsyncResources(() => Promise.reject(workError)),
		(error) => error === workError,
	);
	await assert.rejects(
		withAsyncResources((defer) => {
			defer(() => {
				throw cleanupError;
			});
			return 1;
		}),
		(error) => error === cleanupError,
	);
	await assert.rejects(
		withAsyncResources((defer) => {
			defer(() => {
				throw cleanupError;
			});
			throw workError;
		}),
		(error) => error instanceof SuppressedError && error.error === cleanupError && error.suppressed === workError,
	);
	assert.equal(encodeView(new Uint8Array([0, 1, 2, 3]).subarray(1, 3)), "AQI=");
	assert.deepEqual(roundTrip({ nested: [1, "two"] }), { nested: [1, "two"] });
	assert.deepEqual(
		decodeFrames([frame(new Uint8Array([4])), frame(new Uint8Array([5, 6]))]).map((value) => [
			...new Uint8Array(value),
		]),
		[[4], [5, 6]],
	);
	assert.throws(() => decodeFrames([new Uint8Array([0, 0, 0])]), RangeError);
	assert.equal(await postTask(() => 9, { priority: "user-visible" }), 9);
	const aborted = new AbortController();
	aborted.abort(new Error("cancelled"));
	await assert.rejects(postTask(() => 1, { signal: aborted.signal }));
});

test("operation, observable, signal, and SSE helpers observe values and cleanup", async () => {
	const { AsyncOperation } = await import("@serve-tools/async-operation");
	const { Observable } = await import("@serve-tools/ponyfill-observable");
	const { Signal } = await import("@serve-tools/signal");
	const { collectOperation } = await helper("async-operation");
	const { firstValue } = await helper("ponyfill-observable");
	const { effect } = await helper("reactive-state");
	const { createInitialEventSource } = await helper("sse");
	const operation = new AsyncOperation(async (write) => {
		await write("progress");
		return "done";
	});
	assert.deepEqual(await collectOperation(operation), { values: ["progress"], result: "done" });
	assert.equal(await firstValue(Observable.from([3, 4])), 3);
	await assert.rejects(firstValue(Observable.from([])), /without a value/);
	const observableError = new Error("observable");
	await assert.rejects(
		firstValue(new Observable((subscriber) => subscriber.error(observableError))),
		(error) => error === observableError,
	);
	const alreadyAborted = new AbortController();
	alreadyAborted.abort(new Error("aborted"));
	await assert.rejects(
		firstValue(Observable.from([1]), alreadyAborted.signal),
		(error) => error === alreadyAborted.signal.reason,
	);
	let cancelled = false;
	const pending = firstValue(
		new Observable((subscriber) => subscriber.addTeardown(() => (cancelled = true))),
		AbortSignal.timeout(1),
	);
	await assert.rejects(pending);
	assert.equal(cancelled, true);
	const state = new Signal.State(1);
	const computed = new Signal.Computed(() => state.get() * 2);
	const values = [];
	const stop = effect(computed, (value) => values.push(value));
	state.set(2);
	await new Promise((resolve) => queueMicrotask(resolve));
	stop();
	assert.deepEqual(values, [2, 4]);
	const response = await createInitialEventSource("ready", { ok: true })(new Request("https://example.test"));
	assert.equal(response.status, 200);
	const reader = response.body.getReader();
	const first = await reader.read();
	await reader.cancel();
	assert.match(new TextDecoder().decode(first.value), /event: ready/);
	assert.equal(
		(await createInitialEventSource("ready", true)(new Request("https://example.test", { method: "POST" }))).status,
		405,
	);
});

test("router, contract, and messaging helpers retain package validation and ownership", async () => {
	await import("@serve-tools/polyfill-urlpattern");
	const { pagedRoute } = await helper("router");
	const { defineContract } = await helper("http-contract");
	const { connectUntilAborted } = await helper("client-messaging");
	const page = pagedRoute("/items");
	assert.equal(page.href(), "/items");
	assert.equal(page.match("https://example.test/items?page=2")?.search.page, 2);
	assert.equal(page.match("https://example.test/items?page=0"), null);
	assert.equal(page.match("https://example.test/items?page=01"), null);
	assert.throws(() => page.href({ search: { page: 0 } }), /positive integer/);
	assert.throws(() => page.href({ search: { page: 1.5 } }), /positive integer/);
	assert.throws(() => defineContract(null), /API definition must be an object/);
	const contract = defineContract({
		routes: { "/health": { GET: { responses: { 204: null } } } },
	});
	assert.equal(contract.routes["/health"].GET.responses[204], null);
	const { serve } = await import("@serve-tools/client-messaging");
	const { port1, port2 } = new MessageChannel();
	const controller = new AbortController();
	const client = connectUntilAborted(port1, controller.signal);
	const server = serve(port2, { requests: {} });
	await client.ready;
	controller.abort("finished");
	await client.closed;
	await server.closed;
	port1.close();
	port2.close();
	const { port1: earlyPort, port2: earlyPeer } = new MessageChannel();
	const earlyController = new AbortController();
	let removed = 0;
	const remove = earlyController.signal.removeEventListener.bind(earlyController.signal);
	earlyController.signal.removeEventListener = (...arguments_) => {
		if (arguments_[0] === "abort") {
			++removed;
		}
		return remove(...arguments_);
	};
	const earlyClient = connectUntilAborted(earlyPort, earlyController.signal);
	earlyClient.close();
	await earlyClient.closed;
	assert.equal(removed, 1);
	earlyPort.close();
	earlyPeer.close();
});

test.after(cleanup);
