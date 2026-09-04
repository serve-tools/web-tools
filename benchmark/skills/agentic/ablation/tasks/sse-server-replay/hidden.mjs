import { assert, loadSolution } from "../_shared.mjs";

const { createReplayFeed } = await loadSolution();
const unknownFeed = createReplayFeed();
const unknownDecoder = new TextDecoder();

unknownFeed.send(10);

const unknownResponse = await unknownFeed.fetch("missing");
const unknownReader = unknownResponse.body.getReader();

unknownFeed.send(11);

assert.equal(unknownDecoder.decode((await unknownReader.read()).value), 'event: tick\nid: 11\ndata: {"value":11}\n\n');

await unknownReader.cancel();
unknownFeed.close();

const feed = createReplayFeed();
const decoder = new TextDecoder();

feed.send(1);
feed.send(2);
feed.send(3);

const response = await feed.fetch("1");
const reader = response.body.getReader();

feed.send(4);

const replayed = [decoder.decode((await reader.read()).value), decoder.decode((await reader.read()).value)];

assert.deepEqual(replayed, ['event: tick\nid: 2\ndata: {"value":2}\n\n', 'event: tick\nid: 3\ndata: {"value":3}\n\n']);

assert.equal(decoder.decode((await reader.read()).value), 'event: tick\nid: 4\ndata: {"value":4}\n\n');

await reader.cancel();
feed.close();
feed.close();
