import { assert, loadSolution } from "../_shared.mjs";

const { createStatusHandler } = await loadSolution();

for (const initial of [
	null,
	Array(1),
	[{ service: "other", status: "up", revision: 1 }],
	[{ service: "api", status: "unknown", revision: 1 }],
	[{ service: "api", status: "up", revision: 0 }],
	[{ service: "api", status: "up", revision: 1.5 }],
	[{ service: "api", status: "up", revision: Number.MAX_SAFE_INTEGER + 1 }],
	[{ service: "api", status: "up", revision: 1, extra: true }],
]) {
	assert.throws(() => createStatusHandler(initial), TypeError);
}

const first = { service: "api", status: "up", revision: 2 };
const second = { service: "api", status: "down", revision: 3 };
const handle = createStatusHandler([first, second]);
first.status = "down";
first.revision = 99;
second.status = "up";
second.revision = 100;

let response = await handle(new Request("https://example.test/statuses/api"));
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { service: "api", status: "down", revision: 3 });

response = await handle(new Request("https://example.test/statuses/worker"));
assert.equal(response.status, 404);
assert.deepEqual(await response.json(), { error: "not_found" });

const put = (service, body) =>
	handle(
		new Request(`https://example.test/statuses/${service}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

response = await put("api", { status: "up", revision: 4 });
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { service: "api", status: "up", revision: 4 });

for (const revision of [4, 1]) {
	response = await put("api", { status: "down", revision });
	assert.equal(response.status, 409);
	assert.deepEqual(await response.json(), { error: "stale_revision", revision: 4 });
}
response = await handle(new Request("https://example.test/statuses/api"));
assert.deepEqual(await response.json(), { service: "api", status: "up", revision: 4 });

response = await put("worker", { status: "down", revision: 1 });
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { service: "worker", status: "down", revision: 1 });

response = await handle(
	new Request("https://example.test/statuses/api", {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: "{",
	}),
);
assert.equal(response.status, 400);

response = await handle(
	new Request("https://example.test/statuses/api", {
		method: "PUT",
		headers: { "content-type": "text/plain" },
		body: JSON.stringify({ status: "up", revision: 5 }),
	}),
);
assert.equal(response.status, 415);

response = await put("api", { status: "up", revision: 5, extra: "x" });
assert.equal(response.status, 400);

response = await handle(
	new Request("https://example.test/statuses/api", {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ status: "up", revision: 5, padding: "x".repeat(100) }),
	}),
);
assert.equal(response.status, 413);

response = await handle(new Request("https://example.test/unknown"));
assert.equal(response.status, 404);
response = await handle(new Request("https://example.test/statuses/api", { method: "POST" }));
assert.equal(response.status, 405);
