/** Private state exposed by one toggle to its current direct group. */
export interface ToggleHandle {
	readonly element: HTMLElement;
	readonly button: HTMLButtonElement | null;
	readonly disabled: boolean;
	readonly hasValue: boolean;
	readonly pressed: boolean;
	readonly value: string;
	releaseGroup(group: ToggleGroupController): void;
	setGroupDisabled(group: ToggleGroupController, disabled: boolean): void;
	setGroupTabIndex(group: ToggleGroupController, tabIndex: "-1" | "0" | undefined): void;
	setPressed(pressed: boolean): void;
}

/** Private synchronous transaction boundary exposed by a connected toggle group. */
export interface ToggleGroupController {
	readonly changing: boolean;
	begin(toggle: ToggleHandle, pressed: boolean): ToggleGroupLease | undefined;
	has(toggle: ToggleHandle): boolean;
	memberChanged(toggle: ToggleHandle): void;
	setPressed(toggle: ToggleHandle, pressed: boolean): void;
}

/** Private lease spanning one toggle's child proposal, group proposal, commit, and post-events. */
export interface ToggleGroupLease {
	complete(sourceEvent: MouseEvent, notify: () => void): boolean;
	release(): void;
}

const handles = new WeakMap<HTMLElement, ToggleHandle>();
const groups = new WeakMap<HTMLElement, ToggleGroupController>();

export const registerToggle = (element: HTMLElement, handle: ToggleHandle): void => {
	handles.set(element, handle);
};

export const getToggle = (element: Element): ToggleHandle | undefined => handles.get(element as HTMLElement);

export const getDirectToggleGroup = (toggle: ToggleHandle): ToggleGroupController | undefined => {
	const parent = toggle.element.parentElement;
	return parent ? groups.get(parent) : undefined;
};

export const registerToggleGroup = (element: HTMLElement, controller: ToggleGroupController): void => {
	groups.set(element, controller);
};

export const getToggleGroup = (toggle: ToggleHandle): ToggleGroupController | undefined => {
	const controller = getDirectToggleGroup(toggle);
	return controller?.has(toggle) ? controller : undefined;
};
