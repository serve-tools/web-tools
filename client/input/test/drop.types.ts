import type { DropEndReason, DropTargetCleanup } from "../src/client-input.js";
import { observeDropTarget } from "../src/client-input.js";

const dropZone = document.createElement("div");
const controller = new AbortController();

const cleanup: DropTargetCleanup = observeDropTarget(
	dropZone,
	{
		start(event) {
			this.classList.add("drag-active");
			console.log(event.dataTransfer?.types);
		},
		over(event) {
			if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
		},
		end(state, event) {
			this.classList.remove("drag-active");

			if (state.reason === "drop") event?.preventDefault();
		},
	},
	{ signal: controller.signal },
);

observeDropTarget(document, {});
observeDropTarget(document.createElement("div").attachShadow({ mode: "open" }), {});
observeDropTarget(window, {});

const reason: DropEndReason = "stopped";

// @ts-expect-error drop-target reasons use the package's exact terminal vocabulary
const invalidReason: DropEndReason = "cancelled";

cleanup();
void reason;
void invalidReason;
