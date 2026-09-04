import { assert, loadSolution } from "../_shared.mjs";

const { encodePacket, decodePacket } = await loadSolution();

let state = 0x6d2b79f5;
for (const length of [0, 1, 2, 3, 4, 5, 31, 32, 255, 256, 1023]) {
	const backing = new Uint8Array(length + 7).fill(0xa5);
	const view = backing.subarray(3, 3 + length);

	for (let index = 0; index < length; ++index) {
		state = (Math.imul(state ^ (state >>> 15), 1 | state) + index) >>> 0;
		view[index] = state & 0xff;
	}

	const decoded = decodePacket(encodePacket(view));
	assert.deepEqual([...decoded], [...view]);
	if (decoded.length) {
		decoded[0] ^= 0xff;
	}
	assert.deepEqual([...decodePacket(encodePacket(view))], [...view]);
}

assert.deepEqual([...decodePacket(encodePacket(Buffer.from([1, 2, 3])))], [1, 2, 3]);
assert.deepEqual([...decodePacket(encodePacket(new (class extends Uint8Array {})([4, 5])))], [4, 5]);
assert.throws(() => encodePacket(new Uint8Array(65_536)), TypeError);
assert.throws(() => decodePacket(null), TypeError);
assert.throws(() => decodePacket(undefined), TypeError);
assert.throws(() => decodePacket({}), TypeError);

const malformed = [
	new Uint8Array(),
	new Uint8Array([1, 0, 0, 0]),
	new Uint8Array([2, 0, 0, 0, 0]),
	new Uint8Array([1, 0, 1, 0, 0]),
	new Uint8Array([1, 0, 0, 0, 2, 7]),
];
for (const bytes of malformed) {
	assert.throws(() => decodePacket(Buffer.from(bytes).toString("base64url")), TypeError);
}

assert.throws(() => decodePacket("A"), TypeError);
assert.throws(() => decodePacket("AQAAAAA="), TypeError);

const canonical = encodePacket(new Uint8Array());
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const alternate = alphabet
	.split("")
	.map((character) => `${canonical.slice(0, -1)}${character}`)
	.find(
		(candidate) =>
			candidate !== canonical && Buffer.from(candidate, "base64url").equals(Buffer.from(canonical, "base64url")),
	);
assert.equal(typeof alternate, "string");
assert.throws(() => decodePacket(alternate), TypeError);
