import { assert, loadSolution } from "../_shared.mjs";

const { encodePacket, decodePacket } = await loadSolution();
const storage = new Uint8Array([99, 251, 255, 0, 17, 88]);
const token = encodePacket(storage.subarray(1, 5));
const wire = Buffer.from(token, "base64url");

assert.deepEqual([...wire], [1, 0, 0, 0, 4, 251, 255, 0, 17]);
assert.deepEqual([...decodePacket(token)], [251, 255, 0, 17]);
assert.deepEqual([...decodePacket(encodePacket(new Uint8Array()))], []);
assert.throws(() => encodePacket(new DataView(new ArrayBuffer(2))), TypeError);
assert.throws(() => decodePacket(`${token}=`), TypeError);
assert.throws(() => decodePacket("++++"), TypeError);
assert.throws(() => decodePacket("AQAAAAUAAQ"), TypeError);
