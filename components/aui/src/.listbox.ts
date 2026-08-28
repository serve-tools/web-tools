import type { OptionElement } from "./option-element.js";

/** Synchronizes the option semantics owned by one listbox. */
export const setListboxState = (
	options: readonly OptionElement[],
	active: OptionElement | undefined,
	selected: ReadonlySet<string>,
	invalid: ReadonlySet<OptionElement> = new Set(),
): void => {
	for (const option of options) {
		option.ensureListboxId();
		const value = option.getAttribute("value");
		option.setListboxState(option === active, value !== null && selected.has(value), invalid.has(option));
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
