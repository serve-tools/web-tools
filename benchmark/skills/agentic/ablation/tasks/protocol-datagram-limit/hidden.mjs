import { encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { assert, loadSolution } from "../_shared.mjs";

const { readMeter } = await loadSolution();

for (const length of [0, 1, 31]) {
	assert.equal(readMeter(encodeDatagram(7, { payload: new ArrayBuffer(length) }), 64), length);
}

assert.throws(() => readMeter(encodeDatagram(7, { payload: new ArrayBuffer(96) }), 64));
assert.throws(() => readMeter(encodeDatagram(6, { payload: new ArrayBuffer(1) }), 64), TypeError);
assert.throws(() => readMeter(encodeDatagram(7, { payload: new ArrayBuffer(1), extra: true }), 64), TypeError);
assert.throws(() => readMeter(encodeDatagram(7, Uint8Array.of(1)), 64), TypeError);
assert.throws(() => readMeter(encodeDatagram(7, null), 64), TypeError);
