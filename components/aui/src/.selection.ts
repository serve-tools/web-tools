import type { AttributeOwner } from "./.popover.js";
import type { OptionElement } from "./option-element.js";

/** Private callbacks published by one selection owner. */
export interface SelectionOwner {
	readonly element: HTMLElement;
	membershipChanged(): void;
	setOptionSelected(option: OptionElement, selected: boolean): boolean;
}

const owners = new WeakMap<HTMLElement, SelectionOwner>();
interface OwnedId {
	readonly authored: string | null;
	readonly id: string;
	readonly root: Node;
}

const ownedIds = new WeakMap<Element, OwnedId>();
let generatedId = 0;

/** Publishes an owner only after its constructor has established its state. */
export const registerSelectionOwner = (owner: SelectionOwner): void => {
	owners.set(owner.element, owner);

	// A newly upgraded nested owner changes which ancestor owns its options. Defer
	// the notification until the nested constructor and the current upgrade pass finish.
	queueMicrotask(() => {
		if (owners.get(owner.element) !== owner) {
			return;
		}
		for (let parent = owner.element.parentElement; parent; parent = parent.parentElement) {
			const ancestor = owners.get(parent);
			if (ancestor) {
				ancestor.membershipChanged();
				break;
			}
		}
	});
};

/** Removes an owner whose construction did not complete. */
export const unregisterSelectionOwner = (owner: SelectionOwner): void => {
	if (owners.get(owner.element) === owner) {
		owners.delete(owner.element);
	}
};

/** The nearest registered selection owner, if it is the supplied element. */
export const ownsOption = (owner: HTMLElement, option: OptionElement): boolean =>
	selectionOwner(option)?.element === owner;

/** Delegates a public option selectedness write to its current owner. */
export const setOwnedOptionSelected = (option: OptionElement, selected: boolean): boolean =>
	selectionOwner(option)?.setOptionSelected(option, selected) ?? false;

/** Synchronously invalidates the current owner after a reflected option property changes. */
export const notifySelectionOwner = (option: OptionElement): void => selectionOwner(option)?.membershipChanged();

const selectionOwner = (option: OptionElement): SelectionOwner | undefined => {
	for (let parent = option.parentElement; parent; parent = parent.parentElement) {
		const owner = owners.get(parent);
		if (owner) {
			return owner;
		}
	}

	return undefined;
};

export const uniqueValues = (values: readonly string[]): readonly string[] => {
	if (!Array.isArray(values)) {
		throw new TypeError("Selection values must be an array of strings");
	}

	const result: string[] = [];
	for (const value of values) {
		if (typeof value !== "string") {
			throw new TypeError("Selection values must be strings");
		}
		if (!result.includes(value)) {
			result.push(value);
		}
	}

	return Object.freeze(result);
};

export const sameValues = (left: readonly string[], right: readonly string[]): boolean =>
	left.length === right.length && left.every((value, index) => value === right[index]);

/** Owns a useful ID that cannot collide with another element in the current tree root. */
export const ownSelectionId = (attributes: AttributeOwner, element: Element, prefix: string): string => {
	const authored = attributes.authorValue(element, "id");
	const root = element.getRootNode();
	const cached = ownedIds.get(element);
	if (cached?.root === root && cached.id === element.id && cached.authored === authored) {
		return cached.id;
	}
	const current = element.id;
	const scope = "querySelectorAll" in root ? (root as ParentNode) : element.ownerDocument;
	const collision =
		current !== "" &&
		!authored &&
		[...scope.querySelectorAll("[id]")].some((candidate) => candidate !== element && candidate.id === current);
	const id = authored || (current && !collision ? current : nextId(scope, prefix));
	attributes.own(element, "id", id);
	ownedIds.set(element, { authored, id, root });
	return id;
};

/** Invalidates a cached ID before an explicit external-state reconciliation. */
export const invalidateSelectionId = (element: Element): void => {
	ownedIds.delete(element);
};

const nextId = (scope: ParentNode, prefix: string): string => {
	let id: string;
	do {
		id = `${prefix}-${++generatedId}`;
	} while (scope.querySelector(`#${id}`));
	return id;
};
