import { requestIdleCallback as requestBunIdleCallback } from "../runtime/bun.js";
import { requestIdleCallback as requestDenoIdleCallback } from "../runtime/deno.js";
import { requestIdleCallback as requestNodeIdleCallback } from "../runtime/node.js";

/** Compile-tests every explicit server-runtime entrypoint. */
export function scheduleRuntimeIdleWork(): number[] {
	return [requestNodeIdleCallback(() => {}), requestBunIdleCallback(() => {}), requestDenoIdleCallback(() => {})];
}
