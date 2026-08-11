/// <reference lib="dom" />

import type { WorkerClient, WorkerProtocol } from "./.types.js";
import { connect } from "./connect.js";

/** A platform `SharedWorker` with a typed protocol client connected to its port. */
export class SharedWorker<P extends WorkerProtocol = WorkerProtocol> extends globalThis.SharedWorker {
	/** The typed client connected to the worker's port. */
	readonly client: WorkerClient<P> = connect<P>(this.port);
}
