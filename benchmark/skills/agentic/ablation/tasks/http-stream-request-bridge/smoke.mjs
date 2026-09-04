import { assert, loadSolution } from "../_shared.mjs";

const { createIdentityClient } = await loadSolution();
const client = createIdentityClient();

assert.equal(await client.lookup("a"), "a");

client.close();
