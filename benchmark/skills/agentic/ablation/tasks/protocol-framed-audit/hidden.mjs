import { serialize } from "@serve-tools/realtime-protocol";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import { assert, loadSolution } from "../_shared.mjs";

const originalPush = FrameDecoder.prototype.push;
const originalFinish = FrameDecoder.prototype.finish;
const pushed = [];
const finished = [];

FrameDecoder.prototype.push = function (chunk) {
	pushed.push({ decoder: this, chunk });

	return originalPush.call(this, chunk);
};
FrameDecoder.prototype.finish = function () {
	finished.push(this);

	return originalFinish.call(this);
};

try {
	const { decodeAuditChunks } = await loadSolution();
	const first = encodeFrame(serialize([1, "a"]));
	const second = encodeFrame(serialize({ n: 2 }));
	const all = new Uint8Array(first.length + second.length);

	all.set(first);
	all.set(second, first.length);

	assert.deepEqual(decodeAuditChunks([all.subarray(0, 2), all.subarray(2, 7), all.subarray(7)]), [
		[1, "a"],
		{ n: 2 },
	]);
	assert.equal(pushed.length, 3);
	assert.equal(
		pushed.every(({ decoder }) => decoder === pushed[0].decoder),
		true,
	);
	assert.deepEqual(finished, [pushed[0].decoder]);
	assert.deepEqual(decodeAuditChunks([]), []);
	assert.throws(() => decodeAuditChunks([first.subarray(0, first.length - 1)]), RangeError);
	assert.throws(() => decodeAuditChunks([encodeFrame(Uint8Array.of(255))]));
	assert.throws(() => decodeAuditChunks([new DataView(new ArrayBuffer(4))]), TypeError);
	assert.throws(() => decodeAuditChunks(new Array(1)), TypeError);
} finally {
	FrameDecoder.prototype.push = originalPush;
	FrameDecoder.prototype.finish = originalFinish;
}
