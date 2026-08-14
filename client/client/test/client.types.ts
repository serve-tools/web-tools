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

import { context, db, input, interaction, keyboard, messaging, storage } from "../src/client.js";
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
import type * as storageModule from "../src/lib/storage.js";

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
const storageNamespace: typeof storageModule = storage;

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
	storageNamespace,
];
