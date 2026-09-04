import { serialize } from "@serve-tools/realtime-protocol";
import { encodeFrame } from "@serve-tools/realtime-protocol/stream";
import { assert, loadSolution } from "../_shared.mjs";

const { decodeAuditChunks } = await loadSolution();
const frame = encodeFrame(serialize({ ok: true }));

assert.deepEqual(decodeAuditChunks([frame]), [{ ok: true }]);
