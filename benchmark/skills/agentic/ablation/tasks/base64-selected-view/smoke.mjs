import { assert, loadSolution } from "../_shared.mjs";

const { encodeSlice } = await loadSolution();

assert.equal(encodeSlice(Uint8Array.of(9, 251, 255, 8), 1, 3, "base64"), "+/8=");
assert.equal(encodeSlice(Uint8Array.of(9, 251, 255, 8), 1, 3, "base64url"), "-_8");
