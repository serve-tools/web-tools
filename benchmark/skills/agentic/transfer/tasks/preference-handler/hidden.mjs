import { assert, loadSolution } from "../_shared.mjs";

const { createPreferenceHandler } = await loadSolution();
const mutable = { userId: 3, key: "theme", value: "light" };
const handler = createPreferenceHandler([
	mutable,
	{ userId: 3, key: "theme", value: null },
	{ userId: 3, key: "nickname", value: "first" },
]);
mutable.value = "changed";

assert.deepEqual(await json(handler, "/users/3/preferences/theme"), [200, { key: "theme", value: null }]);
assert.deepEqual(await json(handler, "/users/3/preferences/nickname"), [200, { key: "nickname", value: "first" }]);
const retained = (await json(handler, "/users/3/preferences/nickname"))[1];
retained.value = "mutated response";
assert.deepEqual(await json(handler, "/users/3/preferences/nickname"), [200, { key: "nickname", value: "first" }]);

for (const value of ["", "x", null, "héllo", "x".repeat(80)]) {
	const response = await request(
		handler,
		"/users/3/preferences/theme",
		"PATCH",
		JSON.stringify({ value }),
		"application/json",
	);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { key: "theme", value });
}

for (const body of [{}, { value: undefined }, { value: 1 }, { value: "x", extra: true }, [], null]) {
	const response = await request(
		handler,
		"/users/3/preferences/theme",
		"PATCH",
		JSON.stringify(body),
		"application/json",
	);
	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), { error: "invalid_request" });
}

let response = await request(handler, "/users/3/preferences/theme", "PATCH", "{", "application/json");
assert.equal(response.status, 400);
assert.deepEqual(await response.json(), { error: "invalid_request" });
response = await request(handler, "/users/3/preferences/theme", "PATCH", JSON.stringify({ value: "x" }), "text/plain");
assert.equal(response.status, 415);
assert.deepEqual(await response.json(), { error: "unsupported_media_type" });
response = await request(
	handler,
	"/users/3/preferences/theme",
	"PATCH",
	JSON.stringify({ value: "x".repeat(200) }),
	"application/json",
);
assert.equal(response.status, 413);
assert.deepEqual(await response.json(), { error: "request_too_large" });
response = await request(
	handler,
	"/users/3/preferences/theme",
	"PATCH",
	JSON.stringify({ value: "é".repeat(58) }),
	"application/json",
);
assert.equal(response.status, 200);
response = await request(
	handler,
	"/users/3/preferences/theme",
	"PATCH",
	JSON.stringify({ value: "é".repeat(59) }),
	"application/json",
);
assert.equal(response.status, 413);

for (const pathname of [
	"/users/0/preferences/theme",
	"/users/-1/preferences/theme",
	"/users/01/preferences/theme",
	"/users/9007199254740992/preferences/theme",
	"/users/1/preferences/other",
]) {
	const invalid = await handler(new Request(`https://example.test${pathname}`));
	assert.equal(invalid.status, 400);
	assert.deepEqual(await invalid.json(), { error: "invalid_request" });
}

response = await handler(new Request("https://example.test/users/3/preferences/theme", { method: "POST" }));
assert.equal(response.status, 405);
assert.deepEqual(await response.json(), { error: "method_not_allowed" });
const allow = new Set((response.headers.get("Allow") ?? "").split(/\s*,\s*/));
assert.deepEqual(allow, new Set(["GET", "PATCH", "DELETE"]));

response = await handler(new Request("https://example.test/users/3/preferences/nickname", { method: "DELETE" }));
assert.equal(response.status, 204);
response = await handler(new Request("https://example.test/users/3/preferences/nickname", { method: "DELETE" }));
assert.equal(response.status, 404);

for (const initial of [
	[{ userId: 0, key: "theme", value: "x" }],
	[{ userId: 1, key: "other", value: "x" }],
	[{ userId: 1, key: "theme", value: undefined }],
	[{ userId: 1, key: "theme", value: null, extra: true }],
]) {
	assert.throws(() => createPreferenceHandler(initial), TypeError);
}

async function json(selected, pathname) {
	const response = await selected(new Request(`https://example.test${pathname}`));
	return [response.status, await response.json()];
}

function request(selected, pathname, method, body, mediaType) {
	return selected(
		new Request(`https://example.test${pathname}`, {
			method,
			headers: { "Content-Type": mediaType },
			body,
		}),
	);
}
