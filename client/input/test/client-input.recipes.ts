import { observeDropTarget, observePointer } from "../src/client-input.js";

const controller = new AbortController();
const handle = document.createElement("button");
const dropZone = document.createElement("div");

observePointer(
	handle,
	{
		move(state) {
			this.style.translate = `${state.delta.x}px ${state.delta.y}px`;
		},
		end() {
			this.style.removeProperty("translate");
		},
	},
	{ signal: controller.signal },
);

observeDropTarget(dropZone, {
	over(event) {
		if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
	},
	end(state) {
		if (state.reason === "drop") this.dataset.received = "true";
	},
});

controller.abort();
