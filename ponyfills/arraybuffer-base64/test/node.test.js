import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { toBase64 } from "../runtime/node.js";

test("encodes standard and URL-safe base64 with the requested padding", () => {
	const bytes = new Uint8Array([251, 255]);

	assert.equal(toBase64(bytes), "+/8=");
	assert.equal(toBase64(bytes, { omitPadding: true }), "+/8");
	assert.equal(toBase64(bytes, { alphabet: "base64url" }), "-_8=");
	assert.equal(toBase64(bytes, { alphabet: "base64url", omitPadding: true }), "-_8");
});

test("encodes only the selected Uint8Array view", () => {
	const bytes = new Uint8Array([0, 251, 255, 0]);

	assert.equal(toBase64(bytes.subarray(1, 3)), "+/8=");
});

test("accepts Uint8Array subclasses, Buffers, and cross-realm Uint8Arrays", () => {
	class Bytes extends Uint8Array {}

	const crossRealmBytes = vm.runInNewContext("new Uint8Array([251, 255])");

	assert.equal(toBase64(new Bytes([251, 255])), "+/8=");
	assert.equal(toBase64(Buffer.from([251, 255])), "+/8=");
	assert.equal(toBase64(crossRealmBytes), "+/8=");
});

test("validates the receiver before options and reads options in proposal order", () => {
	const reads = [];
	const options = {
		get alphabet() {
			reads.push("alphabet");
			return "base64";
		},
		get omitPadding() {
			reads.push("omitPadding");
			return false;
		},
	};

	assert.throws(() => toBase64(new Uint8ClampedArray(), options), TypeError);
	assert.deepEqual(reads, []);
	assert.equal(toBase64(new Uint8Array(), options), "");
	assert.deepEqual(reads, ["alphabet", "omitPadding"]);
});

test("rejects invalid receivers, options, alphabets, and detached views", () => {
	assert.throws(() => toBase64(new Uint8ClampedArray()), TypeError);
	assert.throws(() => toBase64(new Uint16Array()), TypeError);
	assert.throws(() => toBase64({}), TypeError);
	assert.throws(() => toBase64(new Uint8Array(), null), TypeError);
	assert.throws(() => toBase64(new Uint8Array(), "base64"), TypeError);
	assert.throws(() => toBase64(new Uint8Array(), { alphabet: null }), TypeError);
	assert.throws(() => toBase64(new Uint8Array(), { alphabet: "standard" }), TypeError);

	const detached = new Uint8Array([1]);
	structuredClone(detached.buffer, { transfer: [detached.buffer] });

	assert.throws(() => toBase64(detached), TypeError);

	const resizable = new ArrayBuffer(8, { maxByteLength: 8 });
	const outOfBounds = new Uint8Array(resizable, 4, 4);
	resizable.resize(2);

	assert.throws(() => toBase64(outOfBounds), TypeError);
});
