import type { OptionElement } from "./OptionElement.js";

/** Synchronizes the option semantics owned by one listbox. */
export const setListboxState = (
	records: readonly { readonly invalid: boolean; readonly option: OptionElement }[],
	active: OptionElement | undefined,
	selected?: ReadonlySet<string>,
): void => {
	for (const record of records) {
		const option = record.option;
		option.ensureListboxId();
		const value = option.getAttribute("value");
		option.setListboxState(option === active, value !== null && selected?.has(value) === true, record.invalid);
	}
};

export const nextEnabledOption = (
	options: readonly OptionElement[],
	current: OptionElement | undefined,
	delta: number,
): OptionElement | undefined => {
	if (options.length === 0) {
		return undefined;
	}
	const index = current ? options.indexOf(current) : delta < 0 ? 0 : -1;
	return options[(index + delta + options.length) % options.length];
};
