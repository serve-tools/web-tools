/// <reference lib="dom" />

import { observeDropTarget, observePointer } from "@serve-tools/client-input";

const query = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);

	if (!element) throw new Error(`Missing demo element: ${selector}`);

	return element;
};

const pointerPad = query<HTMLElement>("#pointer-pad");
const pointerOutput = query<HTMLOutputElement>("#pointer-output");
const dropZone = query<HTMLElement>("#drop-zone");
const dropOutput = query<HTMLOutputElement>("#drop-output");
const clamp = (value: number): number => Math.min(100, Math.max(0, value));

const stopPointer = observePointer(pointerPad, {
	start(state, event) {
		if (!event.isPrimary || event.button !== 0) return false;

		event.preventDefault();
		this.dataset.active = "";
		updatePointer(state.ratio.x, state.ratio.y, `Started with ${state.pointerType || "pointer"}`);
	},
	move(state) {
		updatePointer(state.ratio.x, state.ratio.y, `Δ ${state.delta.x.toFixed(0)}, ${state.delta.y.toFixed(0)} px`);
	},
	end(state) {
		delete this.dataset.active;
		updatePointer(state.ratio.x, state.ratio.y, `Ended: ${state.reason}`);
	},
});

const updatePointer = (x: number, y: number, message: string): void => {
	pointerPad.style.setProperty("--pointer-x", `${clamp(x * 100)}%`);
	pointerPad.style.setProperty("--pointer-y", `${clamp(y * 100)}%`);
	pointerOutput.value = message;
};

query<HTMLElement>("#drag-token").addEventListener("dragstart", (event) => {
	event.dataTransfer?.setData("text/plain", "A normalized drag session");
});

const stopDrop = observeDropTarget(dropZone, {
	start() {
		this.dataset.active = "";
		dropOutput.value = "Session started.";
	},
	over(event) {
		if (event.dataTransfer?.types.includes("text/plain")) event.preventDefault();
	},
	end(state, event) {
		delete this.dataset.active;

		if (state.reason === "drop" && event !== undefined) {
			event.preventDefault();
			dropOutput.value = `Dropped: ${event.dataTransfer?.getData("text/plain") || "unknown data"}`;
		} else {
			dropOutput.value = `Ended: ${state.reason}`;
		}
	},
});

addEventListener(
	"pagehide",
	() => {
		stopPointer();
		stopDrop();
	},
	{ once: true },
);
