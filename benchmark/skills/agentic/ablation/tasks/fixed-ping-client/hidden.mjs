import { assert, loadSolution } from "../_shared.mjs";

const { createPingClient } = await loadSolution();

for (const [fetchImpl, baseURL] of [
	[null, "https://example.test"],
	[fetch, "/relative"],
	[fetch, "ftp://example.test"],
	[fetch, new URL("https://example.test")],
]) {
	assert.throws(() => createPingClient(fetchImpl, baseURL), TypeError);
}

let request;
const client = createPingClient(async (input, init) => {
	request = new Request(input, init);
	return Response.json({ ready: false });
}, "https://example.test/nested/path/");
const controller = new AbortController();
assert.deepEqual(
	await client.ping({
		method: "POST",
		headers: { accept: "text/plain", "x-test": "passed" },
		signal: controller.signal,
	}),
	{ ready: false, requestURL: "https://example.test/ping" },
);
assert.equal(request.url, "https://example.test/ping");
assert.equal(request.method, "GET");
assert.equal(request.headers.get("accept"), "application/json");
assert.equal(request.headers.get("x-test"), "passed");
assert.equal(request.signal.aborted, false);

for (const init of [null, 1, []]) {
	await assert.rejects(client.ping(init), TypeError);
}

const unavailable = createPingClient(
	async () => Response.json({ error: "unavailable" }, { status: 503 }),
	"http://example.test/base/",
);
assert.deepEqual(await unavailable.ping(), { ready: false, requestURL: "http://example.test/ping" });

const extraReady = createPingClient(async () => Response.json({ ready: true, extra: 1 }), "https://example.test");
assert.deepEqual(await extraReady.ping(), { ready: true, requestURL: "https://example.test/ping" });
const extraUnavailable = createPingClient(
	async () => Response.json({ error: "unavailable", extra: 1 }, { status: 503 }),
	"https://example.test",
);
assert.deepEqual(await extraUnavailable.ping(), { ready: false, requestURL: "https://example.test/ping" });

for (const [name, response] of [
	["malformed JSON", new Response("{", { headers: { "content-type": "application/json" } })],
	["non-JSON content", new Response("not json", { headers: { "content-type": "text/plain" } })],
	["invalid declared body", Response.json({ ready: "yes" })],
	["undeclared status", Response.json({ ready: true }, { status: 500 })],
]) {
	const invalid = createPingClient(async () => response, "https://example.test");
	await assert.rejects(invalid.ping(), undefined, name);
}

const networkReason = new Error("network");
const failed = createPingClient(async () => {
	throw networkReason;
}, "https://example.test");
await assert.rejects(failed.ping(), (error) => error === networkReason);

const abortController = new AbortController();
const aborting = createPingClient(async (input, init) => {
	const signal = new Request(input, init).signal;
	return new Promise((_, reject) => {
		signal.addEventListener("abort", () => reject(signal.reason), { once: true });
	});
}, "https://example.test");
const pending = aborting.ping({ signal: abortController.signal });
const abortReason = new Error("abort");
const checked = assert.rejects(pending, (error) => error === abortReason);
abortController.abort(abortReason);
await checked;
