import { assert, loadSolution } from "../_shared.mjs";

const { createInventoryHandler } = await loadSolution();
assert.equal(typeof createInventoryHandler, "function");

const source = { id: 2, name: "pen", quantity: 3 };
const handle = createInventoryHandler([source]);
source.name = "mutated";

let response = await handle(new Request("https://api.test/items/2"));
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { id: 2, name: "pen", quantity: 3 });

response = await handle(
	new Request("https://api.test/items/2", {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ name: "pencil", quantity: 5 }),
	}),
);
assert.equal(response.status, 204);
assert.equal(await response.text(), "");
assert.deepEqual(await (await handle(new Request("https://api.test/items/2"))).json(), {
	id: 2,
	name: "pencil",
	quantity: 5,
});

response = await handle(new Request("https://api.test/items/02"));
assert.equal(response.status, 400);
assert.deepEqual(await response.json(), { error: "invalid_request" });
