import { assert, loadSolution } from "../_shared.mjs";

const { encodeParts } = await loadSolution();
const first = Uint8Array.of(99, 1, 2, 99).subarray(1, 3);
const last = Buffer.from([3, 4]).subarray(1);
const token = encodeParts([first, new Uint8Array(), last]);

assert.deepEqual([...Buffer.from(token, "base64url")], [1, 2, 4]);
assert.deepEqual([...first], [1, 2]);
assert.deepEqual([...last], [4]);
assert.equal(encodeParts([]), "");
assert.equal(encodeParts([Uint8Array.of(1)]), "AQ");
assert.throws(() => encodeParts([new DataView(new ArrayBuffer())]), TypeError);
assert.throws(() => encodeParts("parts"), TypeError);

const sparse = new Array(1);

assert.throws(() => encodeParts(sparse), TypeError);
