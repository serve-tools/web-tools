import { html } from "lit";
import type { Ref } from "lit/directives/ref.js";
import { ref } from "lit/directives/ref.js";

import { callbackRef } from "../src/lit-signals.js";

const buttonRef = callbackRef<HTMLButtonElement>(
	(button) => {
		button.disabled = true;

		return () => {
			button.disabled = false;
		};
	},
	{ waitUntilConnected: true },
);

const litRef: Ref<HTMLButtonElement> = buttonRef;
const callback: callbackRef.Callback<HTMLButtonElement> = (button) => () => button.focus();
const cleanup: callbackRef.Cleanup = () => undefined;
const options: callbackRef.Options = { waitUntilConnected: false };

html`<button ${ref(buttonRef)}></button>`;

buttonRef.value?.focus();
litRef.value?.focus();
callback(document.createElement("button"));
cleanup();
void options;

// @ts-expect-error Callback refs expose a readonly value.
buttonRef.value = undefined;

// @ts-expect-error Callback refs may only return cleanup functions.
callbackRef(() => document.createElement("div"));
