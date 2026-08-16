# Recipe: quick start

This public-import example is generated from the compile-checked `test/server-websocket.recipes.ts` fixture in the package source.

```ts
import type { Handlers, WebSocketLike } from "@serve-tools/server-websocket";
import { attach } from "@serve-tools/server-websocket";

interface RoomProtocol {
	requests: {
		getRoom(input: { id: string }): { title: string };
	};
	subscriptions: {
		presence(input: { id: string }): { online: number };
	};
}

interface Session {
	readonly userID: string;
}

const handlers = {
	requests: {
		getRoom: ({ id }, { connection, signal }) => ({ title: `${connection.userID}:${id}:${signal.aborted}` }),
	},
	subscriptions: {
		presence: (_input, { emit, complete }) => {
			emit({ online: 1 });
			complete();
		},
	},
} satisfies Handlers<RoomProtocol, Session>;

/** A compile-tested accepted-socket, typed-handler, connection-context, and disposal recipe. */
export function serverWebSocketRecipe(socket: WebSocketLike, session: Session): void {
	using _connection = attach<RoomProtocol, Session>(socket, handlers, session);
}
```
