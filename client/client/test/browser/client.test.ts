import * as inputDropModule from "@serve-tools/client-input/drop";
import * as inputPointerModule from "@serve-tools/client-input/pointer";
import * as interactionClipboardModule from "@serve-tools/client-interaction/clipboard";
import * as interactionEyedropperModule from "@serve-tools/client-interaction/eyedropper";
import * as interactionFilePickerModule from "@serve-tools/client-interaction/file-picker";
import * as interactionShareModule from "@serve-tools/client-interaction/share";
import * as messagingWindowModule from "@serve-tools/client-messaging/scope/window";
import * as messagingWorkerModule from "@serve-tools/client-messaging/scope/worker";
import * as sharedDatabaseWorkerModule from "@serve-tools/client-shared-db/scope/shared-worker";
import * as sharedDatabaseWindowModule from "@serve-tools/client-shared-db/scope/window";
import { expect, test } from "vitest";

import { context, db, input, interaction, keyboard, messaging, storage } from "../../src/client.js";
import * as contextModule from "../../src/lib/context.js";
import * as sharedDatabaseWorker from "../../src/lib/db/scope/shared-worker.js";
import * as sharedDatabaseWindow from "../../src/lib/db/scope/window.js";
import * as dbModule from "../../src/lib/db.js";
import * as inputDrop from "../../src/lib/input/drop.js";
import * as inputPointer from "../../src/lib/input/pointer.js";
import * as inputModule from "../../src/lib/input.js";
import * as interactionClipboard from "../../src/lib/interaction/clipboard.js";
import * as interactionEyedropper from "../../src/lib/interaction/eyedropper.js";
import * as interactionFilePicker from "../../src/lib/interaction/file-picker.js";
import * as interactionShare from "../../src/lib/interaction/share.js";
import * as interactionModule from "../../src/lib/interaction.js";
import * as keyboardModule from "../../src/lib/keyboard.js";
import * as messagingWindow from "../../src/lib/messaging/scope/window.js";
import * as messagingWorker from "../../src/lib/messaging/scope/worker.js";
import * as messagingModule from "../../src/lib/messaging.js";
import * as storageModule from "../../src/lib/storage.js";

test("exports each client dependency as a stable namespace", (): void => {
	expect(context).toBe(contextModule);
	expect(db).toBe(dbModule);
	expect(input).toBe(inputModule);
	expect(interaction).toBe(interactionModule);
	expect(keyboard).toBe(keyboardModule);
	expect(messaging).toBe(messagingModule);
	expect(storage).toBe(storageModule);
});

test("re-exports focused input and interaction capabilities", (): void => {
	expect(inputDrop.observeDropTarget).toBe(inputDropModule.observeDropTarget);
	expect(inputPointer.observePointer).toBe(inputPointerModule.observePointer);
	expect(interactionClipboard.writeToClipboard).toBe(interactionClipboardModule.writeToClipboard);
	expect(interactionEyedropper.openEyeDropper).toBe(interactionEyedropperModule.openEyeDropper);
	expect(interactionFilePicker.openFiles).toBe(interactionFilePickerModule.openFiles);
	expect(interactionShare.share).toBe(interactionShareModule.share);
});

test("re-exports shared database operations under database scopes", (): void => {
	expect(sharedDatabaseWindow.connect).toBe(sharedDatabaseWindowModule.connect);
	expect(sharedDatabaseWorker.listen).toBe(sharedDatabaseWorkerModule.listen);
});

test("re-exports messaging helpers under messaging scopes", (): void => {
	expect(messagingWindow.SharedWorker).toBe(messagingWindowModule.SharedWorker);
	expect(messagingWindow.connect).toBe(messagingWindowModule.connect);
	expect(messagingWindow.transfer).toBe(messagingWindowModule.transfer);
	expect(messagingWorker.listen).toBe(messagingWorkerModule.listen);
	expect(messagingWorker.transfer).toBe(messagingWorkerModule.transfer);
});
