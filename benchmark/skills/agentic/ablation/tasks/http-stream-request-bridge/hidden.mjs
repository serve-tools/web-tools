import { assert, loadSolution } from "../_shared.mjs";

const { createIdentityClient } = await loadSolution();
const client = createIdentityClient();

assert.deepEqual(await Promise.all([client.lookup("token-9"), client.lookup("second")]), ["token-9", "second"]);
await assert.rejects(client.lookup(""), (error) => error?.name === "HTTPError" && error?.status === 401);

client.close();
client.close();

await assert.rejects(client.lookup("late"));
