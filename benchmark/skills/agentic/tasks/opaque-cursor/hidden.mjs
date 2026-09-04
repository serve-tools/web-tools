import { assert, loadSolution } from "../_shared.mjs";

const { decodeCursor, encodeCursor } = await loadSolution();

assert.equal(encodeCursor({ offset: 0, label: "" }), encodeCursor({ offset: 0, label: "" }));
assert.deepEqual(decodeCursor(encodeCursor({ offset: Number.MAX_SAFE_INTEGER, label: "😀" })), {
	offset: Number.MAX_SAFE_INTEGER,
	label: "😀",
});

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const canonical = encodeCursor({ offset: 1, label: "" });
const lastIndex = alphabet.indexOf(canonical.at(-1));
const nonCanonical = `${canonical.slice(0, -1)}${alphabet[lastIndex + 1]}`;

assert.equal(Buffer.from(nonCanonical, "base64url").equals(Buffer.from(canonical, "base64url")), true);
assert.throws(() => decodeCursor(nonCanonical), TypeError);

for (const input of [null, { offset: -1, label: "x" }, { offset: 1.5, label: "x" }, { offset: 1, label: "\ud800" }]) {
	assert.throws(() => encodeCursor(input), TypeError);
}

const raw = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

for (const token of [
	1,
	"+w",
	"_w",
	raw("{"),
	raw({ v: 2, o: 0, l: "x" }),
	raw({ v: 1, o: -1, l: "x" }),
	raw({
		v: 1,
		o: 0,
		l: "x",
		extra: true,
	}),
]) {
	assert.throws(() => decodeCursor(token), TypeError, String(token));
}
