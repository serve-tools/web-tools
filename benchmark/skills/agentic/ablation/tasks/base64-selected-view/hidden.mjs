import { assert, loadSolution } from "../_shared.mjs";

const { encodeSlice } = await loadSolution();
let state = 17;

for (const length of [0, 1, 2, 7, 31]) {
	const backing = new Uint8Array(length + 8).fill(99);

	for (let index = 0; index < length; ++index) {
		state = (state * 1_103_515_245 + 12_345) >>> 0;
		backing[index + 4] = state;
	}

	const view = backing.subarray(3, backing.length - 2);

	for (const [start, end] of [
		[1, 1],
		[1, view.length - 1],
		[0, view.length],
	]) {
		for (const alphabet of ["base64", "base64url"]) {
			assert.equal(
				encodeSlice(view, start, end, alphabet),
				Buffer.from(view.subarray(start, end)).toString(alphabet),
			);
		}
	}
}

const oneByteView = Uint8Array.of(90, 1, 90).subarray(1, 2);

assert.equal(encodeSlice(oneByteView, 0, 1, "base64url"), "AQ");
assert.equal(encodeSlice(Buffer.from([1, 2, 3, 4]), 1, 3, "base64url"), "AgM");

for (const arguments_ of [
	[{}, 0, 0, "base64"],
	[Uint8Array.of(1), -1, 0, "base64"],
	[Uint8Array.of(1), 0.5, 1, "base64"],
	[Uint8Array.of(1), 1, 0, "base64"],
	[Uint8Array.of(1), 0, 2, "base64"],
	[Uint8Array.of(1), 0, 1, "other"],
]) {
	assert.throws(() => encodeSlice(...arguments_), TypeError);
}
