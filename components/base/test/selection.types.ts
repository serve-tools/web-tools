import type {
	AutocompleteChangeDetail,
	AutocompleteEventMap,
	SelectionChangeDetail,
	SelectionEventMap,
} from "@serve-tools/base-components";
import { AutocompleteElement, ComboboxElement, OptionElement, SelectElement } from "@serve-tools/base-components";
import type {
	AutocompleteElement as Autocomplete,
	AutocompleteChangeDetail as AutocompleteDetail,
	AutocompleteEventMap as AutocompleteEvents,
} from "@serve-tools/base-components/autocomplete";
import type {
	ComboboxElement as Combobox,
	SelectionChangeDetail as ComboboxDetail,
	SelectionEventMap as ComboboxEvents,
} from "@serve-tools/base-components/combobox";
import type { OptionElement as Option } from "@serve-tools/base-components/option";
import type {
	SelectElement as Select,
	SelectionChangeDetail as SelectDetail,
	SelectionEventMap as SelectEvents,
} from "@serve-tools/base-components/select";

const autocompleteConstructor: typeof Autocomplete = AutocompleteElement;
const comboboxConstructor: typeof Combobox = ComboboxElement;
const optionConstructor: typeof Option = OptionElement;
const selectConstructor: typeof Select = SelectElement;
const autocomplete = null as unknown as AutocompleteElement;
const combobox = null as unknown as ComboboxElement;
const option = null as unknown as OptionElement;
const select = null as unknown as SelectElement;
const elements: HTMLElement[] = [autocomplete, combobox, option, select];

const input: HTMLInputElement | null = autocomplete.input;
const autocompletePopup: HTMLElement | null = autocomplete.popup;
autocomplete.refresh();
autocomplete.addEventListener("beforechange", (event) => {
	const typed: AutocompleteEventMap["beforechange"] = event;
	const subpathTyped: AutocompleteEvents["beforechange"] = event;
	const detail: AutocompleteChangeDetail = event.detail;
	const subpathDetail: AutocompleteDetail = detail;
	const value: string = detail.value;
	const values: readonly [string] = detail.values;
	const optionValue: string = detail.optionValue;
	const source: Event = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error Autocomplete proposal values are immutable.
	detail.values[0] = "changed";
	void [typed, subpathTyped, subpathDetail, value, values, optionValue, source];
});

option.value = "pro";
option.label = "Professional";
option.disabled = false;
option.selected = true;
option.defaultSelected = true;
const optionValue: string = option.value;
const optionLabel: string = option.label;
const selected: boolean = option.selected;
const defaultSelected: boolean = option.defaultSelected;

for (const field of [combobox, select]) {
	field.value = "pro";
	field.values = ["", "pro"];
	field.name = "service";
	field.multiple = true;
	field.disabled = false;
	field.readOnly = true;
	field.required = true;
	field.setCustomValidity("Application error");
	field.setCustomValidity("");
	field.refresh();
	field.focus({ preventScroll: true });
}

const value: string = combobox.value;
const values: readonly string[] = select.values;
const form: HTMLFormElement | null = combobox.form;
const labels: NodeList = select.labels;
const validity: ValidityState = combobox.validity;
const validationMessage: string = select.validationMessage;
const willValidate: boolean = combobox.willValidate;
const valid: boolean = combobox.checkValidity();
const reported: boolean = select.reportValidity();

combobox.addEventListener("beforechange", (event) => {
	const typed: SelectionEventMap["beforechange"] = event;
	const comboboxTyped: ComboboxEvents["beforechange"] = event;
	const detail: SelectionChangeDetail = event.detail;
	const comboboxDetail: ComboboxDetail = detail;
	const selectDetail: SelectDetail = detail;
	const proposed: readonly string[] = detail.values;
	const source: Event = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error Selection proposal arrays are immutable.
	detail.values.push("extra");
	void [typed, comboboxTyped, comboboxDetail, selectDetail, proposed, source];
});

select.addEventListener("beforechange", (event) => {
	const typed: SelectEvents["beforechange"] = event;
	const detail: SelectDetail = event.detail;
	void [typed, detail];
});

const rootEvents = null as unknown as SelectionEventMap;
const comboboxEvents: ComboboxEvents = rootEvents;
const selectEvents: SelectEvents = rootEvents;
// @ts-expect-error Autocomplete leaves submission identity and scalar value on its native input.
autocomplete.value = "Paris";
// @ts-expect-error Autocomplete is not another form owner.
autocomplete.form;
// @ts-expect-error Current values are exposed as a readonly snapshot.
values.push("extra");
// @ts-expect-error Values assignments require an array, even for one selection.
select.values = "pro";
// @ts-expect-error Native form association is readonly.
combobox.form = form;
// @ts-expect-error Option defaults are boolean reflected state.
option.defaultSelected = "selected";
void [
	autocompleteConstructor,
	comboboxConstructor,
	optionConstructor,
	selectConstructor,
	elements,
	input,
	autocompletePopup,
	optionValue,
	optionLabel,
	selected,
	defaultSelected,
	value,
	form,
	labels,
	validity,
	validationMessage,
	willValidate,
	valid,
	reported,
	comboboxEvents,
	selectEvents,
];
