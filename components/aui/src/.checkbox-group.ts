/** Private state exposed by one checkbox to its current direct group. */
export interface CheckboxHandle {
	readonly element: HTMLElement;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly hasValue: boolean;
	readonly parent: boolean;
	readonly value: string;
	releaseGroup(group: CheckboxGroupController): void;
	setChecked(checked: boolean, dirty?: boolean): void;
	setGroupDisabled(group: CheckboxGroupController, disabled: boolean): void;
	setIndeterminate(indeterminate: boolean): void;
}

/** Private synchronous transaction boundary exposed by a checkbox group. */
export interface CheckboxGroupController {
	readonly changing: boolean;
	begin(checkbox: CheckboxHandle, checked: boolean): CheckboxGroupLease | undefined;
	has(checkbox: CheckboxHandle): boolean;
	memberChanged(checkbox: CheckboxHandle): void;
	setChecked(checkbox: CheckboxHandle, checked: boolean): void;
}

/** Private lease spanning a child proposal, group proposal, atomic commit, and post-events. */
export interface CheckboxGroupLease {
	complete(sourceEvent: MouseEvent, notify: () => void): boolean;
	release(): void;
}

const handles = new WeakMap<HTMLElement, CheckboxHandle>();
const groups = new WeakMap<HTMLElement, CheckboxGroupController>();

export const registerCheckbox = (element: HTMLElement, handle: CheckboxHandle): void => {
	handles.set(element, handle);
};

export const getCheckbox = (element: Element): CheckboxHandle | undefined => handles.get(element as HTMLElement);

export const getDirectCheckboxGroup = (checkbox: CheckboxHandle): CheckboxGroupController | undefined => {
	const parent = checkbox.element.parentElement;
	return parent ? groups.get(parent) : undefined;
};

export const registerCheckboxGroup = (element: HTMLElement, controller: CheckboxGroupController): void => {
	groups.set(element, controller);
};

export const getCheckboxGroup = (checkbox: CheckboxHandle): CheckboxGroupController | undefined => {
	const controller = getDirectCheckboxGroup(checkbox);
	return controller?.has(checkbox) ? controller : undefined;
};
