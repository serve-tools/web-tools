import { assert, loadSolution } from "../_shared.mjs";

const original = Uint8Array.prototype.toBase64;
const { decodeCursor, encodeCursor } = await loadSolution();
assert.equal(typeof encodeCursor, "function");
assert.equal(typeof decodeCursor, "function");

const token = encodeCursor({ offset: 42, label: "café / 東京" });
assert.match(token, /^[A-Za-z0-9_-]+$/);
assert.equal(token.includes("="), false);
assert.deepEqual(decodeCursor(token), { offset: 42, label: "café / 東京" });
assert.equal(Uint8Array.prototype.toBase64, original);
assert.throws(() => decodeCursor(`${token}=`), TypeError);
