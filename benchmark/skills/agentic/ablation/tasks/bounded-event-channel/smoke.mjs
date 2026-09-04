import { assert, loadSolution, waitFor } from "../_shared.mjs";

const { openEventChannel } = await loadSolution();
const channel = await openEventChannel();
const seen = [];
const handle = channel.watch("a", (value) => seen.push(value));

await channel.append("a", 1);
await waitFor(() => seen.length === 1);
assert.deepEqual(await channel.list("a"), [{ topic: "a", value: 1 }]);
handle.unsubscribe();
channel.close();
await channel.closed;
