import type { WorkerHandlers, WorkerProtocol, WorkerServer } from "./.types.js";
import { serve as servePort } from "./serve.js";

/**
 * Serves a protocol for every connection received by the current `SharedWorkerGlobalScope`.
 *
 * The returned live array retains each created server so callers may observe or close them.
 */
export const activate = <const P extends WorkerProtocol>(handlers: WorkerHandlers<P>): readonly WorkerServer<P>[] => {
	const servers: WorkerServer<P>[] = [];
	const scope = globalThis as typeof globalThis & SharedWorkerGlobalScope;

	scope.addEventListener("connect", ({ ports }: MessageEvent) => servers.push(servePort<P>(ports[0], handlers)));

	return servers;
};
