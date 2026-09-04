import { assert, loadSolution } from "../_shared.mjs";

const { createPreferenceHandler } = await loadSolution();
const handler = createPreferenceHandler([{ userId: 2, key: "theme", value: null }]);

let response = await handler(new Request("https://example.test/users/2/preferences/theme"));
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { key: "theme", value: null });

response = await handler(
	new Request("https://example.test/users/2/preferences/nickname", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ value: "Ada" }),
	}),
);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { key: "nickname", value: "Ada" });

response = await handler(new Request("https://example.test/users/2/preferences/nickname", { method: "DELETE" }));
assert.equal(response.status, 204);
assert.equal(await response.text(), "");

response = await handler(new Request("https://example.test/users/2/preferences/nickname"));
assert.equal(response.status, 404);
assert.deepEqual(await response.json(), { error: "not_found" });

response = await patch(handler, "/users/2/preferences/theme", {});
assert.equal(response.status, 400);
assert.deepEqual(await response.json(), { error: "invalid_request" });

response = await handler(new Request("https://example.test/users/0/preferences/theme"));
assert.equal(response.status, 400);

async function patch(selected, pathname, body) {
	return selected(
		new Request(`https://example.test${pathname}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}
