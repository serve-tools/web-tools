import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";
import { connect } from "@serve-tools/client-shared-websocket/scope/window";

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
export const server = listen<AppProtocol>("wss://example.com/app");
