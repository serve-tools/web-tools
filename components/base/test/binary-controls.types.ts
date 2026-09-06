import type {
	CheckboxElement,
	CheckboxGroupChangeDetail,
	SwitchChangeDetail,
	SwitchEventMap,
} from "@serve-tools/base-components";
import { CheckboxGroupElement, SwitchElement } from "@serve-tools/base-components";
import type { CheckboxGroupElement as Group } from "@serve-tools/base-components/checkbox-group";
import type { SwitchElement as Switch } from "@serve-tools/base-components/switch";

const groupConstructor: typeof Group = CheckboxGroupElement;
const switchConstructor: typeof Switch = SwitchElement;
const group = null as unknown as CheckboxGroupElement;
const checkbox = null as unknown as CheckboxElement;
const control = null as unknown as SwitchElement;
const elements: HTMLElement[] = [group, checkbox, control];
const form: HTMLFormElement | null = control.form;
const values: readonly string[] = group.values;
const unchecked: string | undefined = control.uncheckedValue;
control.checked = true;
control.defaultChecked = false;
control.name = "enabled";
control.value = "yes";
control.uncheckedValue = "";
control.uncheckedValue = undefined;
control.required = true;
control.disabled = false;
control.readOnly = true;
control.setCustomValidity("A validation message");
const valid: boolean = control.checkValidity();
group.values = ["a", "b"];
group.disabled = true;
checkbox.parent = true;
control.addEventListener("beforechange", (event) => {
	const detail: SwitchChangeDetail = event.detail;
	const typed: SwitchEventMap["beforechange"] = event;
	const checked: boolean = detail.checked;
	const source: MouseEvent = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error Proposed state is immutable.
	detail.checked = false;
	void [typed, checked, source];
});
group.addEventListener("beforechange", (event) => {
	if ("values" in event.detail) {
		const detail: CheckboxGroupChangeDetail = event.detail;
		const source: CheckboxElement = detail.sourceCheckbox;
		// @ts-expect-error Proposed values are an immutable snapshot.
		detail.values.push("extra");
		void source;
	}
});
// @ts-expect-error Switch has no indeterminate surface.
control.indeterminate = true;
// @ts-expect-error Checkbox Group is not a second form owner.
group.form;
// @ts-expect-error Group selection uses arrays, including a single selected value.
group.values = "a";
// @ts-expect-error Native form ownership is readonly.
control.form = form;
void [groupConstructor, switchConstructor, elements, values, unchecked, valid];
