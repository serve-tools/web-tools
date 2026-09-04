import { assert, loadSolution } from "../_shared.mjs";

const { createStatusHandler } = await loadSolution();
const handle = createStatusHandler([{ service: "api", status: "up", revision: 1 }]);
const response = await handle(new Request("http://example.test/statuses/api"));

assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { service: "api", status: "up", revision: 1 });
