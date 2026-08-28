import {
	AccordionElement,
	AlertDialogElement,
	AUIElement,
	AutocompleteElement,
	AvatarElement,
	CalendarElement,
	CheckboxElement,
	CheckboxGroupElement,
	CollapsibleElement,
	ComboboxElement,
	ContextMenuElement,
	DialogElement,
	DrawerElement,
	FieldElement,
	FileElement,
	MenubarElement,
	MenuElement,
	MeterElement,
	NavigationMenuElement,
	NumberFieldElement,
	OptionElement,
	OTPFieldElement,
	PopoverElement,
	PreviewCardElement,
	ProgressElement,
	ScrollAreaElement,
	SelectElement,
	SeparatorElement,
	SliderElement,
	SwitchElement,
	TabsElement,
	ToastRegionElement,
	ToggleElement,
	ToggleGroupElement,
	ToolbarElement,
	TooltipElement,
} from "@serve-tools/aui";
import { Signal } from "@serve-tools/signal";
import { html, props, text } from "@serve-tools/signal-dom";
import { initializeCalendarAndFileExamples } from "./calendar-and-files.js";
import { initializeFieldExamples } from "./forms.js";
import { initializeGallery } from "./gallery.js";
import { GalleryContextElement, GalleryDropElement, GalleryWorkspaceElement } from "./integrations.js";
import { initializeMenuExamples } from "./menus.js";
import { initializeSelectionExamples } from "./selection.js";
import { initializeSurfaceExamples } from "./surfaces.js";

initializeGallery();

class CounterElement extends AUIElement {
	#count = new Signal.State(0);

	protected override layout(content: DocumentFragment): void {
		html(
			"button",
			props({ type: "button", onclick: () => this.#count.set(this.#count.get() + 1) }),
			text("Count: "),
			text(this.#count),
		)(content);
	}
}

customElements.define("app-checkbox-group", CheckboxGroupElement);
customElements.define("app-checkbox", CheckboxElement);
customElements.define("app-switch", SwitchElement);
customElements.define("app-tabs", TabsElement);
customElements.define("app-dialog", DialogElement);
customElements.define("app-counter", CounterElement);
customElements.define("app-toggle-group", ToggleGroupElement);
customElements.define("app-toggle", ToggleElement);
customElements.define("app-accordion", AccordionElement);
customElements.define("app-collapsible", CollapsibleElement);
customElements.define("app-avatar", AvatarElement);
customElements.define("app-meter", MeterElement);
customElements.define("app-progress", ProgressElement);
customElements.define("app-separator", SeparatorElement);
customElements.define("app-popover", PopoverElement);
customElements.define("app-tooltip", TooltipElement);
customElements.define("app-preview-card", PreviewCardElement);
customElements.define("app-alert-dialog", AlertDialogElement);
customElements.define("app-workspace", GalleryWorkspaceElement);
customElements.define("app-context-value", GalleryContextElement);
customElements.define("app-drop-zone", GalleryDropElement);
customElements.define("app-number-field", NumberFieldElement);
customElements.define("app-otp-field", OTPFieldElement);
customElements.define("app-slider", SliderElement);
customElements.define("app-field", FieldElement);
customElements.define("app-option", OptionElement);
customElements.define("app-autocomplete", AutocompleteElement);
customElements.define("app-combobox", ComboboxElement);
customElements.define("app-select", SelectElement);
customElements.define("app-menu", MenuElement);
customElements.define("app-context-menu", ContextMenuElement);
customElements.define("app-menubar", MenubarElement);
customElements.define("app-navigation-menu", NavigationMenuElement);
customElements.define("app-toolbar", ToolbarElement);
customElements.define("app-drawer", DrawerElement);
customElements.define("app-toast-region", ToastRegionElement);
customElements.define("app-scroll-area", ScrollAreaElement);
customElements.define("app-calendar", CalendarElement);
customElements.define("app-file", FileElement);

initializeCalendarAndFileExamples();
initializeFieldExamples();
initializeSelectionExamples();
initializeMenuExamples();
initializeSurfaceExamples();

document.querySelector<CheckboxElement>("#mixed-checkbox")!.indeterminate = true;

const form = document.querySelector<HTMLFormElement>("#preferences")!;
const checkbox = document.querySelector<CheckboxElement>("#preferences app-checkbox")!;
const lock = document.querySelector<HTMLInputElement>("#lock")!;
const submission = document.querySelector<HTMLOutputElement>("#submission")!;
const interaction = document.querySelector<HTMLOutputElement>("#interaction")!;
const dialog = document.querySelector<DialogElement>("app-dialog")!;
const dialogResult = document.querySelector<HTMLOutputElement>("#dialog-result")!;
const formatting = document.querySelector<ToggleGroupElement>("app-toggle-group")!;
const formattingResult = document.querySelector<HTMLOutputElement>("#formatting-result")!;

checkbox.addEventListener("beforechange", (event) => {
	if (lock.checked) {
		event.preventDefault();
		interaction.textContent = "The proposed change was canceled.";
	}
});
checkbox.addEventListener("change", () => {
	interaction.textContent = checkbox.checked ? "The checkbox is checked." : "The checkbox is unchecked.";
});
form.addEventListener("submit", (event) => {
	event.preventDefault();
	submission.textContent = `Submitted updates: ${new FormData(form).get("updates")}`;
});
form.addEventListener("reset", () => {
	interaction.textContent = "The checkbox was reset to its default.";
	submission.textContent = "No preferences submitted.";
});
document.querySelector("#open-dialog")!.addEventListener("click", () => dialog.showModal());
dialog.addEventListener("close", () => {
	dialogResult.textContent = `Dialog result: ${dialog.returnValue || "dismissed"}`;
});
formatting.addEventListener("change", () => {
	formattingResult.textContent = `Selected formatting: ${formatting.values.join(", ") || "none"}`;
});

const standaloneToggle = document.querySelector<ToggleElement>("#favorite-toggle")!;
standaloneToggle.addEventListener("change", () => {
	document.querySelector("#favorite-result")!.textContent = standaloneToggle.pressed
		? "Added to favorites."
		: "Not a favorite.";
});

const retainedCounter = document.querySelector<CounterElement>("#retained-counter")!;
const counterContainer = retainedCounter.parentElement!;
const connectionButton = document.querySelector<HTMLButtonElement>("#counter-connection")!;
connectionButton.addEventListener("click", () => {
	if (retainedCounter.isConnected) {
		retainedCounter.remove();
		connectionButton.textContent = "Reconnect counter";
	} else {
		counterContainer.prepend(retainedCounter);
		connectionButton.textContent = "Disconnect counter";
	}
});

const meter = document.querySelector<MeterElement>("#storage-meter")!;
const capacity = document.querySelector<HTMLInputElement>("#storage-capacity")!;
capacity.addEventListener("input", () => {
	meter.value = capacity.valueAsNumber;
	meter.setAttribute("aria-valuetext", capacity.value + " of 100 GB");
	document.querySelector("#storage-result")!.textContent = capacity.value + " of 100 GB used";
});

const progress = document.querySelector<ProgressElement>("#upload-progress")!;
const advance = document.querySelector<HTMLButtonElement>("#advance-progress")!;
advance.addEventListener("click", () => {
	if (!progress.hasAttribute("value")) {
		progress.value = 0;
	} else {
		progress.value = progress.value === 100 ? 0 : Math.min(100, progress.value + 20);
	}
	document.querySelector("#progress-result")!.textContent = progress.value + "% complete";
});
document.querySelector("#indeterminate-progress")!.addEventListener("click", () => {
	progress.removeAttribute("value");
	document.querySelector("#progress-result")!.textContent = "Waiting for upload size…";
});

const avatar = document.querySelector<AvatarElement>("#example-avatar")!;
document.querySelector("#avatar-source")!.addEventListener("click", () => {
	avatar.src = avatar.src ? "" : new URL("./avatar.svg", import.meta.url).href;
});

let actionCount = 0;
document.querySelector("#native-action")!.addEventListener("click", () => {
	document.querySelector("#native-action-result")!.textContent =
		`Action ran ${++actionCount} time${actionCount === 1 ? "" : "s"}.`;
});
const nativeInput = document.querySelector<HTMLInputElement>("#native-input")!;
nativeInput.addEventListener("input", () => {
	document.querySelector("#native-input-result")!.textContent = nativeInput.value || "(empty)";
});
const fieldsetEnabled = document.querySelector<HTMLInputElement>("#fieldset-enabled")!;
fieldsetEnabled.addEventListener("change", () => {
	document.querySelector<HTMLFieldSetElement>("#native-fieldset")!.disabled = !fieldsetEnabled.checked;
});
const nativeForm = document.querySelector<HTMLFormElement>("#native-form")!;
nativeForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const entries = new FormData(nativeForm, event.submitter);
	document.querySelector("#native-form-result")!.textContent = Array.from(
		entries,
		([name, value]) => `${name}: ${value}`,
	).join("; ");
});
nativeForm.addEventListener("reset", () => {
	document.querySelector("#native-form-result")!.textContent = "No form submitted.";
});
const radioForm = document.querySelector<HTMLFormElement>("#radio-form")!;
radioForm.addEventListener("submit", (event) => {
	event.preventDefault();
	document.querySelector("#radio-result")!.textContent =
		`Preferred contact: ${new FormData(radioForm).get("contact")}`;
});
radioForm.addEventListener("reset", () => {
	document.querySelector("#radio-result")!.textContent = "No contact preference submitted.";
});

const switchForm = document.querySelector<HTMLFormElement>("#switch-form")!;
switchForm.addEventListener("submit", (event) => {
	event.preventDefault();
	document.querySelector("#switch-result")!.textContent =
		`Automatic updates: ${new FormData(switchForm).get("automatic")}`;
});
switchForm.addEventListener("reset", () => {
	document.querySelector("#switch-result")!.textContent = "No switch setting submitted.";
});
const featureForm = document.querySelector<HTMLFormElement>("#features-form")!;
const featureGroup = document.querySelector<CheckboxGroupElement>("#feature-group")!;
const showFeatureValues = (): void => {
	document.querySelector("#feature-values")!.textContent = `Selected: ${featureGroup.values.join(", ") || "none"}`;
};
featureGroup.addEventListener("change", showFeatureValues);
featureForm.addEventListener("submit", (event) => {
	event.preventDefault();
	document.querySelector("#feature-result")!.textContent =
		`Submitted enabled features: ${new FormData(featureForm).getAll("feature").join(", ") || "none"}`;
});
featureForm.addEventListener("reset", () => {
	queueMicrotask(showFeatureValues);
	document.querySelector("#feature-result")!.textContent = "No features submitted.";
});
const alertDialog = document.querySelector<AlertDialogElement>("app-alert-dialog")!;
document.querySelector("#open-alert")!.addEventListener("click", () => alertDialog.showModal());
alertDialog.addEventListener("close", () => {
	document.querySelector("#alert-result")!.textContent = `Alert result: ${alertDialog.returnValue || "dismissed"}`;
});

const timeForm = document.querySelector<HTMLFormElement>("#time-form")!;
timeForm.addEventListener("submit", (event) => {
	event.preventDefault();
	document.querySelector("#time-result")!.textContent = `Preferred time: ${new FormData(timeForm).get("time")}`;
});
const contextValue = document.querySelector<GalleryContextElement>("app-context-value")!;
const studio = document.querySelector<GalleryWorkspaceElement>("#studio-workspace")!;
const review = document.querySelector<GalleryWorkspaceElement>("#review-workspace")!;
document.querySelector("#move-context")!.addEventListener("click", () => {
	(contextValue.parentElement === studio ? review : studio).append(contextValue);
});
document.querySelector("#rename-context")!.addEventListener("click", () => {
	const provider = contextValue.parentElement!;
	provider.setAttribute(
		"value",
		provider.getAttribute("value") === "Renamed workspace" ? "Local workspace" : "Renamed workspace",
	);
});
const dropZone = document.querySelector<GalleryDropElement>("app-drop-zone")!;
const token = document.querySelector<HTMLElement>("#drag-token")!;
token.addEventListener("dragstart", (event) => {
	event.dataTransfer!.setData("text/plain", "Review token");
	event.dataTransfer!.effectAllowed = "copy";
});
document.querySelector("#send-token")!.addEventListener("click", () => dropZone.receive("Review token"));
