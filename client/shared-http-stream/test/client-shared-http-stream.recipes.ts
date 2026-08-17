import { listen } from "../src/lib/scope/shared-worker.js";
import { connect } from "../src/lib/scope/window.js";

interface AppProtocol {
	requests: {
		profile(id: string): { id: string; name: string };
	};
	subscriptions: {
		presence(room: string): { userId: string; online: boolean };
	};
}

declare const worker: SharedWorker;

export const client = connect<AppProtocol>(worker.port);
export const server = listen<AppProtocol>("https://example.com/realtime");
