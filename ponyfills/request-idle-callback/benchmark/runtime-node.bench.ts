import { benchmark } from "../../../client/benchmark.ts";
import { cancelIdleCallback, requestIdleCallback } from "../runtime/node.js";

const handles = new Array<number>(1_000);
const noop = () => undefined;

await benchmark(
	"request-idle-callback/runtime-node-enqueue-cancel-1k",
	() => {
		for (let index = 0; index < handles.length; ++index) {
			handles[index] = requestIdleCallback(noop);
		}

		for (const handle of handles) {
			cancelIdleCallback(handle);
		}
	},
	{ iterations: 100 },
);
