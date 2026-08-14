import type { PointerCleanup, PointerEndReason, PointerState } from "../src/client-input.js";
import { observePointer } from "../src/client-input.js";

const button = document.createElement("button");
const controller = new AbortController();
const startOnly = (_state: PointerState): void => {};

observePointer(button, { start: startOnly });

const cleanup: PointerCleanup = observePointer(
	button,
	{
		start(state, event) {
			this.disabled = true;

			if (!event.isPrimary || state.pointerType === "ignored") return false;
		},
		move(state, event) {
			this.style.translate = `${state.delta.x}px ${state.delta.y}px`;
			event.preventDefault();
		},
		end(state, event) {
			this.disabled = false;

			if (event === undefined) console.log(state.reason);
		},
	},
	{ signal: controller.signal },
);

const reason: PointerEndReason = "lostcapture";

// @ts-expect-error reasons use the package's exact terminal vocabulary
const invalidReason: PointerEndReason = "lost";

cleanup();
void reason;
void invalidReason;
