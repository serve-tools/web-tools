import { assert, loadSolution } from "../_shared.mjs";

const { createPingClient } = await loadSolution();
const client = createPingClient(async () => Response.json({ ready: true }), "https://example.test/root/");

assert.deepEqual(await client.ping(), { ready: true, requestURL: "https://example.test/ping" });
