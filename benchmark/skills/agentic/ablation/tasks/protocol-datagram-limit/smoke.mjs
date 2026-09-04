import { encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { assert, loadSolution } from "../_shared.mjs";

const { readMeter } = await loadSolution();

assert.equal(readMeter(encodeDatagram(7, { payload: new ArrayBuffer(3) }), 10), 3);
