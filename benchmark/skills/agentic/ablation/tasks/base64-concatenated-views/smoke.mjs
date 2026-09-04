import { assert, loadSolution } from "../_shared.mjs";

const { encodeParts } = await loadSolution();

assert.equal(encodeParts([Uint8Array.of(251), Uint8Array.of(255)]), "-_8");
