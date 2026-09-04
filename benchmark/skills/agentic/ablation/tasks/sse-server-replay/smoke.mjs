import { assert, loadSolution } from "../_shared.mjs";

const { createReplayFeed } = await loadSolution();
const feed = createReplayFeed();
const response = await feed.fetch();

assert.equal(response.headers.get("content-type"), "text/event-stream");
assert.equal(response.headers.get("cache-control"), "no-cache, no-transform");
assert.equal(response.headers.get("x-accel-buffering"), "no");
assert.throws(() => feed.send(Number.NaN), TypeError);
assert.throws(() => feed.send(Infinity), TypeError);
assert.throws(() => feed.send(-Infinity), TypeError);

await response.body.cancel();
feed.close();
