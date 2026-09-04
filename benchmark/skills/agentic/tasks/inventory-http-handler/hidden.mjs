import { assert, loadSolution } from "../_shared.mjs";

const { createInventoryHandler } = await loadSolution();
const handle = createInventoryHandler();

async function put(id, body, contentType = "application/json") {
	return handle(
		new Request(`https://api.test/items/${id}`, {
			method: "PUT",
			headers: { "content-type": contentType },
			body,
		}),
	);
}

let response = await handle(new Request("https://api.test/items/9"));
assert.equal(response.status, 404);
assert.deepEqual(await response.json(), { error: "not_found" });

for (const id of ["0", "-1", "9007199254740992", "nope"]) {
	response = await handle(new Request(`https://api.test/items/${id}`));
	assert.equal(response.status, 400, id);
	assert.deepEqual(await response.json(), { error: "invalid_request" });
}

response = await put("9", JSON.stringify({ name: "box", quantity: -1 }));
assert.equal(response.status, 400);
assert.deepEqual(await response.json(), { error: "invalid_request" });

response = await put("9", "{");
assert.equal(response.status, 400);

response = await put("9", "plain", "text/plain");
assert.equal(response.status, 415);
assert.deepEqual(await response.json(), { error: "unsupported_media_type" });

response = await put("9", JSON.stringify({ name: "x".repeat(300), quantity: 1 }));
assert.equal(response.status, 413);
assert.deepEqual(await response.json(), { error: "request_too_large" });

response = await handle(new Request("https://api.test/items/9", { method: "DELETE" }));
assert.equal(response.status, 405);
assert.deepEqual(await response.json(), { error: "method_not_allowed" });
assert.deepEqual(
	new Set(
		response.headers
			.get("allow")
			?.split(",")
			.map((method) => method.trim()),
	),
	new Set(["GET", "PUT"]),
);
