import type {
	CheckboxChangeDetail,
	CheckboxEventMap,
	TabsActivation,
	TabsOrientation,
	ToggleChangeDetail,
	ToggleGroupChangeDetail,
	ToggleGroupOrientation,
} from "@serve-tools/aui";
import {
	AUIElement,
	CheckboxElement,
	DialogElement,
	TabsElement,
	ToggleElement,
	ToggleGroupElement,
} from "@serve-tools/aui";
import type { AUIElement as BaseElement } from "@serve-tools/aui/base";
import type { CheckboxElement as Checkbox } from "@serve-tools/aui/checkbox";
import type { DialogElement as Dialog } from "@serve-tools/aui/dialog";
import type { TabsElement as Tabs } from "@serve-tools/aui/tabs";
import type { ToggleElement as Toggle } from "@serve-tools/aui/toggle";
import type { ToggleGroupElement as ToggleGroup } from "@serve-tools/aui/toggle-group";

const base: typeof BaseElement = AUIElement;
const checkbox: typeof Checkbox = CheckboxElement;
const dialog: typeof Dialog = DialogElement;
const tabs: typeof Tabs = TabsElement;
const toggle: typeof Toggle = ToggleElement;
const toggleGroup: typeof ToggleGroup = ToggleGroupElement;
const activation: TabsActivation = "manual";
const orientation: TabsOrientation = "vertical";

const checkboxInstance = null as unknown as CheckboxElement;
const checkboxAsHTMLElement: HTMLElement = checkboxInstance;
const checkboxAsEventTarget: EventTarget = checkboxInstance;
checkboxInstance.addEventListener("application-event", null);
checkboxInstance.removeEventListener("application-event", null);
checkboxInstance.checked = true;
checkboxInstance.defaultChecked = false;
checkboxInstance.indeterminate = true;
checkboxInstance.readOnly = true;
checkboxInstance.uncheckedValue = "off";
checkboxInstance.uncheckedValue = undefined;
checkboxInstance.addEventListener("beforechange", function (event) {
	const detail: CheckboxChangeDetail = event.detail;
	const sourceEvent: MouseEvent = detail.sourceEvent;
	void (this satisfies CheckboxElement);
	const next: boolean = detail.checked;
	const proposal: CheckboxEventMap["beforechange"] = event;
	event.preventDefault();
	// @ts-expect-error Proposed checkedness is immutable.
	detail.checked = false;
	void [sourceEvent, next, proposal];
});
checkboxInstance.addEventListener("keydown", (event) => {
	const key: string = event.key;
	void key;
});
const cancelChange = (event: CheckboxEventMap["beforechange"]): void => event.preventDefault();
checkboxInstance.addEventListener("beforechange", cancelChange, { once: true });
checkboxInstance.removeEventListener("beforechange", cancelChange);
const customListener: EventListenerObject = { handleEvent: () => {} };
checkboxInstance.addEventListener("application-event", customListener);
checkboxInstance.removeEventListener("application-event", customListener);
// @ts-expect-error Checkedness is boolean, not a mixed-state string.
checkboxInstance.checked = "mixed";
// @ts-expect-error Omitting the unchecked value uses undefined, not null.
checkboxInstance.uncheckedValue = null;

const toggleInstance = null as unknown as ToggleElement;
const groupInstance = null as unknown as ToggleGroupElement;
const toggleAsHTMLElement: HTMLElement = toggleInstance;
const groupAsHTMLElement: HTMLElement = groupInstance;
const nativeButton: HTMLButtonElement | null = toggleInstance.button;
const groupOrientation: ToggleGroupOrientation = "vertical";
toggleInstance.pressed = true;
toggleInstance.value = "bold";
groupInstance.values = ["bold"];
groupInstance.multiple = true;
groupInstance.orientation = groupOrientation;
groupInstance.loopFocus = false;
toggleInstance.addEventListener("beforechange", function (event) {
	const detail: ToggleChangeDetail = event.detail;
	void (this satisfies ToggleElement);
	// @ts-expect-error Proposed pressedness is immutable.
	detail.pressed = false;
	void detail;
});
groupInstance.addEventListener("beforechange", function (event) {
	void (this satisfies ToggleGroupElement);
	if ("values" in event.detail) {
		const detail: ToggleGroupChangeDetail = event.detail;
		const values: readonly string[] = detail.values;
		// @ts-expect-error Proposed values are immutable.
		detail.values.push("italic");
		void values;
	} else {
		const detail: ToggleChangeDetail = event.detail;
		const pressed: boolean = detail.pressed;
		void pressed;
	}
});
toggleInstance.addEventListener("application-event", null);
toggleInstance.removeEventListener("application-event", null);
groupInstance.addEventListener("application-event", null);
groupInstance.removeEventListener("application-event", null);
// @ts-expect-error Group values always use an array, including single selection.
groupInstance.values = "bold";
// @ts-expect-error Current values are a readonly snapshot.
groupInstance.values.push("italic");

class ApplicationElement extends AUIElement {
	protected layout(content: DocumentFragment): void {
		content.append(this.ownerDocument.createTextNode("ready"));
	}

	protected connect(connection: AUIElement.Connection): () => void {
		this.ownerDocument.addEventListener("application-event", () => {}, { signal: connection.signal });
		return () => {};
	}

	protected moved(connection: AUIElement.Connection): void {
		connection.addCleanup(() => {});
	}
}

void [
	base,
	checkbox,
	checkboxAsHTMLElement,
	checkboxAsEventTarget,
	dialog,
	tabs,
	toggle,
	toggleGroup,
	toggleAsHTMLElement,
	groupAsHTMLElement,
	nativeButton,
	activation,
	orientation,
	ApplicationElement,
];
