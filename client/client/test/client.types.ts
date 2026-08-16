import type * as inputDropModule from "@serve-tools/client-input/drop";
import type * as inputPointerModule from "@serve-tools/client-input/pointer";
import type * as interactionClipboardModule from "@serve-tools/client-interaction/clipboard";
import type * as interactionEyedropperModule from "@serve-tools/client-interaction/eyedropper";
import type * as interactionFilePickerModule from "@serve-tools/client-interaction/file-picker";
import type * as interactionShareModule from "@serve-tools/client-interaction/share";
import type * as messagingWindowModule from "@serve-tools/client-messaging/scope/window";
import type * as messagingWorkerModule from "@serve-tools/client-messaging/scope/worker";
import type * as sharedDatabaseWorkerModule from "@serve-tools/client-shared-db/scope/shared-worker";
import type * as sharedDatabaseWindowModule from "@serve-tools/client-shared-db/scope/window";
import type * as sharedWebSocketWorkerModule from "@serve-tools/client-shared-websocket/scope/shared-worker";

import {
	context,
	db,
	input,
	interaction,
	keyboard,
	messaging,
	sharedWebsocket,
	storage,
	websocket,
} from "../src/client.js";
import type * as contextModule from "../src/lib/context.js";
import * as sharedDatabaseWorker from "../src/lib/db/scope/shared-worker.js";
import * as sharedDatabaseWindow from "../src/lib/db/scope/window.js";
import type * as dbModule from "../src/lib/db.js";
import * as inputDrop from "../src/lib/input/drop.js";
import * as inputPointer from "../src/lib/input/pointer.js";
import type * as inputModule from "../src/lib/input.js";
import * as interactionClipboard from "../src/lib/interaction/clipboard.js";
import * as interactionEyedropper from "../src/lib/interaction/eyedropper.js";
import * as interactionFilePicker from "../src/lib/interaction/file-picker.js";
import * as interactionShare from "../src/lib/interaction/share.js";
import type * as interactionModule from "../src/lib/interaction.js";
import type * as keyboardModule from "../src/lib/keyboard.js";
import * as messagingWindow from "../src/lib/messaging/scope/window.js";
import * as messagingWorker from "../src/lib/messaging/scope/worker.js";
import type * as messagingModule from "../src/lib/messaging.js";
import * as sharedWebSocketWorker from "../src/lib/shared-websocket/scope/shared-worker.js";
import type * as sharedWebsocketModule from "../src/lib/shared-websocket.js";
import type * as storageModule from "../src/lib/storage.js";
import type * as websocketModule from "../src/lib/websocket.js";

interface ClientProtocol {
	requests: {
		ping(): void;
	};
	subscriptions: {
		messages(room: string): string;
	};
}

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

declare const messagingClient: messagingModule.Client<ClientProtocol>;
declare const messagingServer: messagingModule.Server<ClientProtocol>;
declare const messagingListener: messagingModule.Listener<ClientProtocol>;
declare const messagingWindowClient: messagingWindow.Client<ClientProtocol>;
declare const messagingWorkerListener: messagingWorker.Listener<ClientProtocol>;
declare const pendingWebSocketClient: Promise<websocketModule.Client<ClientProtocol>>;

export type MessagingPublicTypes = [
	messagingModule.Client<ClientProtocol>,
	messagingModule.Handlers<ClientProtocol>,
	messagingModule.Listener<ClientProtocol>,
	messagingModule.MessageEndpoint,
	messagingModule.Protocol,
	messagingModule.RequestContext,
	messagingModule.RequestOptions,
	messagingModule.Server<ClientProtocol>,
	messagingModule.SubscribeOptions,
	messagingModule.Subscription,
	messagingModule.SubscriptionContext<string>,
	messagingModule.TransferResult<string>,
	messagingModule.connect.Client<ClientProtocol>,
	messagingModule.connect.MessageEndpoint,
	messagingModule.connect.Protocol,
	messagingModule.connect.RequestOptions,
	messagingModule.connect.SubscribeOptions,
	messagingModule.connect.Subscription,
	messagingModule.serve.Handlers<ClientProtocol>,
	messagingModule.serve.MessageEndpoint,
	messagingModule.serve.Protocol,
	messagingModule.serve.RequestContext,
	messagingModule.serve.Server<ClientProtocol>,
	messagingModule.serve.SubscriptionContext<string>,
	messagingModule.serve.TransferResult<string>,
	Expect<Equal<messagingModule.ProtocolType<typeof messagingClient>, ClientProtocol>>,
	Expect<Equal<messagingModule.ProtocolType<Promise<typeof messagingServer>>, ClientProtocol>>,
	Expect<Equal<messagingModule.ProtocolType<typeof messagingListener>, ClientProtocol>>,
	Expect<Equal<messagingModule.connect.ProtocolType<typeof messagingClient>, ClientProtocol>>,
	Expect<Equal<messagingModule.serve.ProtocolType<typeof messagingServer>, ClientProtocol>>,
];

export type MessagingWindowPublicTypes = [
	messagingWindow.Client<ClientProtocol>,
	messagingWindow.Handlers<ClientProtocol>,
	messagingWindow.Listener<ClientProtocol>,
	messagingWindow.MessageEndpoint,
	messagingWindow.Protocol,
	messagingWindow.RequestContext,
	messagingWindow.RequestOptions,
	messagingWindow.Server<ClientProtocol>,
	messagingWindow.SharedWorker<ClientProtocol>,
	messagingWindow.SubscribeOptions,
	messagingWindow.Subscription,
	messagingWindow.SubscriptionContext<string>,
	messagingWindow.TransferResult<string>,
	messagingWindow.connect.Client<ClientProtocol>,
	messagingWindow.connect.MessageEndpoint,
	messagingWindow.connect.Protocol,
	messagingWindow.connect.RequestOptions,
	messagingWindow.connect.SubscribeOptions,
	messagingWindow.connect.Subscription,
	Expect<Equal<messagingWindow.ProtocolType<typeof messagingWindowClient>, ClientProtocol>>,
	Expect<Equal<messagingWindow.connect.ProtocolType<typeof messagingWindowClient>, ClientProtocol>>,
];

export type MessagingWorkerPublicTypes = [
	messagingWorker.Client<ClientProtocol>,
	messagingWorker.Handlers<ClientProtocol>,
	messagingWorker.Listener<ClientProtocol>,
	messagingWorker.MessageEndpoint,
	messagingWorker.Protocol,
	messagingWorker.RequestContext,
	messagingWorker.RequestOptions,
	messagingWorker.Server<ClientProtocol>,
	messagingWorker.SubscribeOptions,
	messagingWorker.Subscription,
	messagingWorker.SubscriptionContext<string>,
	messagingWorker.TransferResult<string>,
	messagingWorker.listen.Handlers<ClientProtocol>,
	messagingWorker.listen.Listener<ClientProtocol>,
	messagingWorker.listen.MessageEndpoint,
	messagingWorker.listen.Protocol,
	messagingWorker.listen.RequestContext,
	messagingWorker.listen.Server<ClientProtocol>,
	messagingWorker.listen.SubscriptionContext<string>,
	messagingWorker.listen.TransferResult<string>,
	Expect<Equal<messagingWorker.ProtocolType<typeof messagingWorkerListener>, ClientProtocol>>,
	Expect<Equal<messagingWorker.listen.ProtocolType<typeof messagingWorkerListener>, ClientProtocol>>,
];

export type WebSocketPublicTypes = [
	websocketModule.Client<ClientProtocol>,
	websocketModule.ConnectOptions,
	websocketModule.Protocol,
	websocketModule.RequestOptions,
	websocketModule.SubscribeOptions,
	websocketModule.Subscription,
	websocketModule.connect.Client<ClientProtocol>,
	websocketModule.connect.Options,
	websocketModule.connect.Protocol,
	websocketModule.connect.RequestOptions,
	websocketModule.connect.SubscribeOptions,
	websocketModule.connect.Subscription,
	Expect<Equal<websocketModule.ProtocolType<typeof pendingWebSocketClient>, ClientProtocol>>,
	Expect<Equal<websocketModule.ProtocolType<Awaited<typeof pendingWebSocketClient>>, ClientProtocol>>,
	Expect<Equal<websocketModule.connect.ProtocolType<typeof pendingWebSocketClient>, ClientProtocol>>,
	Expect<Equal<websocketModule.connect.ProtocolType<Awaited<typeof pendingWebSocketClient>>, ClientProtocol>>,
];

const contextNamespace: typeof contextModule = context;
const databaseNamespace: typeof dbModule = db;
const inputDropNamespace: typeof inputDropModule = inputDrop;
const inputNamespace: typeof inputModule = input;
const inputPointerNamespace: typeof inputPointerModule = inputPointer;
const interactionClipboardNamespace: typeof interactionClipboardModule = interactionClipboard;
const interactionEyedropperNamespace: typeof interactionEyedropperModule = interactionEyedropper;
const interactionFilePickerNamespace: typeof interactionFilePickerModule = interactionFilePicker;
const interactionNamespace: typeof interactionModule = interaction;
const interactionShareNamespace: typeof interactionShareModule = interactionShare;
const keyboardNamespace: typeof keyboardModule = keyboard;
const messagingNamespace: typeof messagingModule = messaging;
const messagingWindowNamespace: typeof messagingWindowModule = messagingWindow;
const messagingWorkerNamespace: typeof messagingWorkerModule = messagingWorker;
const sharedDatabaseWorkerNamespace: typeof sharedDatabaseWorkerModule = sharedDatabaseWorker;
const sharedDatabaseWindowNamespace: typeof sharedDatabaseWindowModule = sharedDatabaseWindow;
const sharedWebsocketNamespace: typeof sharedWebsocketModule = sharedWebsocket;
const sharedWebSocketWorkerNamespace: typeof sharedWebSocketWorkerModule = sharedWebSocketWorker;
const storageNamespace: typeof storageModule = storage;
const websocketNamespace: typeof websocketModule = websocket;

void [
	contextNamespace,
	databaseNamespace,
	inputDropNamespace,
	inputNamespace,
	inputPointerNamespace,
	interactionClipboardNamespace,
	interactionEyedropperNamespace,
	interactionFilePickerNamespace,
	interactionNamespace,
	interactionShareNamespace,
	keyboardNamespace,
	messagingNamespace,
	messagingWindowNamespace,
	messagingWorkerNamespace,
	sharedDatabaseWorkerNamespace,
	sharedDatabaseWindowNamespace,
	sharedWebsocketNamespace,
	sharedWebSocketWorkerNamespace,
	storageNamespace,
	websocketNamespace,
];
