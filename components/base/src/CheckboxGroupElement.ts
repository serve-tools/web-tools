import type { CheckboxGroupController, CheckboxGroupLease, CheckboxHandle } from "./_checkbox-group.js";
import { getCheckbox, registerCheckboxGroup } from "./_checkbox-group.js";
import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";
import type { CheckboxChangeDetail } from "./CheckboxElement.js";
import { CheckboxElement } from "./CheckboxElement.js";

/** Immutable full selection proposed by a checkbox group's `beforechange` event. */
export interface CheckboxGroupChangeDetail {
	/** The selected ordinary-child values that will be committed unless the transaction is canceled. */
	readonly values: readonly string[];

	/** The direct checkbox that initiated this transaction. */
	readonly sourceCheckbox: CheckboxElement;

	/** The host click that proposed the transition. */
	readonly sourceEvent: MouseEvent;
}

/** Events emitted by a checkbox group. Child checkbox proposals also bubble through the group. */
export interface CheckboxGroupEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<CheckboxChangeDetail | CheckboxGroupChangeDetail>;
}

interface MemberSnapshot {
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly handle: CheckboxHandle;
	readonly hasValue: boolean;
	readonly parent: boolean;
	readonly value: string;
}

interface GroupSnapshot {
	readonly disabled: boolean;
	readonly members: readonly MemberSnapshot[];
}

/** Coordinates direct child checkboxes while leaving each ordinary checkbox as its own form owner. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the interface adds typed DOM event overloads only.
export class CheckboxGroupElement extends BaseElement {
	static readonly observedAttributes = ["disabled"];

	#changing = false;
	readonly #controller: CheckboxGroupController;
	#internals = this.attachInternals();
	#members: CheckboxHandle[] = [];
	#parentStatus: "mixed" | "on" | "off" = "mixed";
	#pendingValues: readonly string[] | undefined;
	#recoveringProperties = true;
	#refreshing = false;
	#revision = 0;

	constructor() {
		super();

		const element = this;
		this.#controller = {
			get changing() {
				return element.#changing;
			},
			begin(checkbox, checked) {
				return element.#begin(checkbox, checked);
			},
			has(checkbox) {
				if (checkbox.element.parentElement !== element || getCheckbox(checkbox.element) !== checkbox) {
					return false;
				}
				element.#refresh();
				return element.#members.includes(checkbox);
			},
			memberChanged(checkbox) {
				if (checkbox.element.parentElement === element) {
					++element.#revision;
					element.#parentStatus = "mixed";
					element.#refresh();
				}
			},
			setChecked(checkbox, checked) {
				element.#setMemberChecked(checkbox, checked);
			},
		};

		for (const property of ["disabled", "values"] as const) {
			upgradeProperty(this, property);
		}
		this.#recoveringProperties = false;

		this.#internals.role = "group";
		this.#synchronizeState();
		registerCheckboxGroup(this, this.#controller);
		this.#refresh();
	}

	/** A frozen DOM-order snapshot of selected, uniquely valued ordinary child checkboxes. */
	get values(): readonly string[] {
		this.#refresh();
		return this.#pendingValues ?? Object.freeze(this.#currentValues());
	}

	set values(values: readonly string[]) {
		if (!Array.isArray(values)) {
			throw new TypeError("Checkbox group values must be an array of strings");
		}
		this.#setValues(values);
	}

	/** Whether the group disables every direct checkbox without changing each checkbox's own disabled property. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	attributeChangedCallback(): void {
		++this.#revision;
		this.#parentStatus = "mixed";
		this.#synchronizeState();
		if (!this.#recoveringProperties) {
			this.#refresh();
		}
	}

	protected connect(connection: BaseElement.Connection): void {
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => {
			++this.#revision;
			this.#parentStatus = "mixed";
			this.#refresh();
		});
		observer.observe(this, {
			attributeFilter: ["checked", "disabled", "parent", "readonly", "value"],
			attributes: true,
			childList: true,
			subtree: true,
		});

		connection.addCleanup(() => {
			observer.disconnect();
			++this.#revision;
			const members = this.#members;
			this.#members = [];
			const errors: unknown[] = [];
			for (const member of members) {
				try {
					member.releaseGroup(this.#controller);
				} catch (error) {
					errors.push(error);
				}
			}
			if (errors.length === 1) {
				throw errors[0];
			}
			if (errors.length > 1) {
				throw new AggregateError(errors, "Checkbox group member cleanup failed");
			}
		});

		this.#refresh();
	}

	protected moved(): void {
		this.#refresh();
	}

	#begin(checkbox: CheckboxHandle, checked: boolean): CheckboxGroupLease | undefined {
		if (this.#changing) {
			return;
		}

		this.#refresh();
		const before = this.#snapshot();
		const source = before.members.find((member) => member.handle === checkbox);
		if (!source || source.disabled || source.checked === checked) {
			return;
		}
		if (!source.parent && !this.#isSelectable(source, before.members)) {
			return;
		}

		const revision = this.#revision;
		const element = this;
		let active = true;
		this.#changing = true;

		return {
			complete(sourceEvent, notify) {
				if (!active) {
					return false;
				}
				active = false;
				try {
					return element.#complete(checkbox, checked, sourceEvent, notify, before, revision);
				} finally {
					element.#changing = false;
				}
			},
			release() {
				if (!active) {
					return;
				}
				active = false;
				element.#changing = false;
			},
		};
	}

	#complete(
		checkbox: CheckboxHandle,
		checked: boolean,
		sourceEvent: MouseEvent,
		notify: () => void,
		before: GroupSnapshot,
		revision: number,
	): boolean {
		if (revision !== this.#revision || !this.#snapshotEquals(before, this.#snapshot())) {
			return false;
		}

		const selectable = this.#selectableMembers(before.members);
		const selected = new Set(selectable.filter((member) => member.checked).map((member) => member.handle));
		const source = before.members.find((member) => member.handle === checkbox)!;
		let nextParentStatus = this.#parentStatus;

		if (source.parent) {
			const disabledChecked = new Set(
				selectable.filter((member) => member.disabled && member.checked).map((member) => member.handle),
			);
			const selectableAll = new Set(
				selectable.filter((member) => !member.disabled || member.checked).map((member) => member.handle),
			);
			const allOnOrOff = selected.size === selectableAll.size || selected.size === 0;
			if (allOnOrOff) {
				const wasAll = selected.size === selectableAll.size;
				selected.clear();
				for (const member of wasAll ? disabledChecked : selectableAll) {
					selected.add(member);
				}
			} else if (this.#parentStatus === "mixed") {
				selected.clear();
				for (const member of selectableAll) {
					selected.add(member);
				}
				nextParentStatus = "on";
			} else if (this.#parentStatus === "on") {
				selected.clear();
				for (const member of disabledChecked) {
					selected.add(member);
				}
				nextParentStatus = "off";
			}
		} else {
			if (checked) {
				selected.add(checkbox);
			} else {
				selected.delete(checkbox);
			}
			nextParentStatus = "mixed";
		}

		const values = Object.freeze(
			selectable.filter((member) => selected.has(member.handle)).map((member) => member.value),
		);
		const detail = Object.freeze({
			values,
			sourceCheckbox: checkbox.element as CheckboxElement,
			sourceEvent,
		}) satisfies CheckboxGroupChangeDetail;
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<CheckboxGroupChangeDetail>("beforechange", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail,
		});

		if (
			!this.dispatchEvent(proposal) ||
			revision !== this.#revision ||
			!this.#snapshotEquals(before, this.#snapshot()) ||
			!this.#commitInteraction(selected, before, revision)
		) {
			return false;
		}

		this.#parentStatus = nextParentStatus;
		++this.#revision;
		this.#synchronizeParents();
		notify();
		return true;
	}

	#setMemberChecked(checkbox: CheckboxHandle, checked: boolean): void {
		this.#refresh();
		if (!this.#members.includes(checkbox) || checkbox.element.parentElement !== this) {
			checkbox.setChecked(checked);
			return;
		}

		const snapshot = this.#snapshot();
		const member = snapshot.members.find((candidate) => candidate.handle === checkbox)!;
		const selectable = this.#selectableMembers(snapshot.members);
		const selected = new Set(
			selectable.filter((candidate) => candidate.checked).map((candidate) => candidate.handle),
		);
		if (member.parent) {
			for (const candidate of selectable) {
				if (!candidate.disabled) {
					if (checked) {
						selected.add(candidate.handle);
					} else {
						selected.delete(candidate.handle);
					}
				}
			}
		} else {
			if (!this.#isSelectable(member, snapshot.members)) {
				throw new TypeError("A grouped checkbox requires an explicit unique value attribute");
			}
			if (checked) {
				selected.add(checkbox);
			} else {
				selected.delete(checkbox);
			}
		}

		++this.#revision;
		this.#parentStatus = "mixed";
		this.#commit(selected);
	}

	#setValues(values: readonly string[]): void {
		const requested = new Set<string>();
		for (const value of values) {
			if (typeof value !== "string" || requested.has(value)) {
				throw new TypeError("Checkbox group values must be unique strings");
			}
			requested.add(value);
		}

		if (this.#recoveringProperties) {
			const members = this.#readMembers();
			if ((members.length > 0 || this.children.length > 0) && !this.#hasUnresolvedCheckboxChildren()) {
				this.#resolveValues(requested, members);
			}
			this.#pendingValues = Object.freeze([...requested]);
			return;
		}

		const members = this.#readMembers();
		if (members.length === 0 && requested.size > 0) {
			++this.#revision;
			this.#pendingValues = Object.freeze([...requested]);
			return;
		}

		const selected = this.#resolveValues(requested, members);

		++this.#revision;
		this.#parentStatus = "mixed";
		this.#refresh();
		this.#commit(selected);
	}

	#commit(selected: ReadonlySet<CheckboxHandle>, preservePending = false): void {
		if (!preservePending) {
			this.#pendingValues = undefined;
		}
		const snapshot = this.#snapshot();
		for (const member of this.#selectableMembers(snapshot.members)) {
			member.handle.setChecked(selected.has(member.handle));
		}
		this.#synchronizeParents();
	}

	#commitInteraction(selected: ReadonlySet<CheckboxHandle>, before: GroupSnapshot, revision: number): boolean {
		for (const member of this.#selectableMembers(before.members)) {
			if (revision !== this.#revision || !this.#commitContextEquals(before)) {
				return false;
			}
			member.handle.setChecked(selected.has(member.handle));
			if (revision !== this.#revision || !this.#commitContextEquals(before)) {
				return false;
			}
		}
		this.#pendingValues = undefined;
		return true;
	}

	#applyPendingValues(): void {
		const pending = this.#pendingValues;
		if (!pending || this.#members.length === 0) {
			return;
		}

		const snapshot = this.#snapshot();
		const selectable = this.#selectableMembers(snapshot.members);
		const selected = new Set<CheckboxHandle>();
		for (const value of pending) {
			const matches = selectable.filter((member) => member.value === value);
			if (matches.length !== 1) {
				return;
			}
			selected.add(matches[0].handle);
		}
		this.#commit(selected, this.#hasUnresolvedCheckboxChildren());
	}

	#refresh(): void {
		if (this.#refreshing || this.#recoveringProperties) {
			return;
		}
		this.#refreshing = true;

		try {
			const previous = this.#members;
			const members = this.#readMembers();
			if (members.length !== previous.length || members.some((member, index) => member !== previous[index])) {
				++this.#revision;
				this.#parentStatus = "mixed";
			}
			this.#members = members;

			for (const member of members) {
				member.setGroupDisabled(this.#controller, this.disabled);
			}
			for (const member of previous) {
				if (!members.includes(member)) {
					member.releaseGroup(this.#controller);
				}
			}

			this.#applyPendingValues();
			this.#synchronizeParents();
		} finally {
			this.#refreshing = false;
		}
	}

	#synchronizeParents(): void {
		const snapshot = this.#snapshotFrom(this.#members);
		const selectable = this.#selectableMembers(snapshot.members);
		const selectedCount = selectable.filter((member) => member.checked).length;
		const checked = selectedCount === selectable.length;
		const indeterminate = selectedCount > 0 && selectedCount !== selectable.length;
		for (const member of snapshot.members) {
			if (member.parent) {
				member.handle.setChecked(checked, false);
				member.handle.setIndeterminate(indeterminate);
			}
		}
	}

	#snapshot(): GroupSnapshot {
		return this.#snapshotFrom(this.#readMembers());
	}

	#snapshotFrom(members: readonly CheckboxHandle[]): GroupSnapshot {
		return {
			disabled: this.disabled,
			members: members.map((handle) => ({
				checked: handle.checked,
				disabled: handle.disabled,
				handle,
				hasValue: handle.hasValue,
				parent: handle.parent,
				value: handle.value,
			})),
		};
	}

	#commitContextEquals(before: GroupSnapshot): boolean {
		if (before.disabled !== this.disabled) {
			return false;
		}
		const members = this.#readMembers();
		if (members.length !== before.members.length) {
			return false;
		}
		return before.members.every((member, index) => {
			const handle = members[index];
			return (
				handle === member.handle &&
				handle.disabled === member.disabled &&
				handle.hasValue === member.hasValue &&
				handle.parent === member.parent &&
				handle.value === member.value
			);
		});
	}

	#snapshotEquals(left: GroupSnapshot, right: GroupSnapshot): boolean {
		if (left.disabled !== right.disabled || left.members.length !== right.members.length) {
			return false;
		}
		return left.members.every((member, index) => {
			const other = right.members[index];
			return (
				member.checked === other.checked &&
				member.disabled === other.disabled &&
				member.handle === other.handle &&
				member.hasValue === other.hasValue &&
				member.parent === other.parent &&
				member.value === other.value
			);
		});
	}

	#selectableMembers(members: readonly MemberSnapshot[]): MemberSnapshot[] {
		const counts = new Map<string, number>();
		for (const member of members) {
			if (!member.parent && member.hasValue) {
				counts.set(member.value, (counts.get(member.value) ?? 0) + 1);
			}
		}
		return members.filter((member) => !member.parent && member.hasValue && counts.get(member.value) === 1);
	}

	#isSelectable(member: MemberSnapshot, members: readonly MemberSnapshot[]): boolean {
		return this.#selectableMembers(members).includes(member);
	}

	#currentValues(): string[] {
		const snapshot = this.#snapshotFrom(this.#members);
		return this.#selectableMembers(snapshot.members)
			.filter((member) => member.checked)
			.map((member) => member.value);
	}

	#readMembers(): CheckboxHandle[] {
		return [...this.children].map(getCheckbox).filter((member) => member !== undefined);
	}

	#hasUnresolvedCheckboxChildren(): boolean {
		const registry = this.ownerDocument.defaultView?.customElements ?? customElements;
		return [...this.children].some((child) => {
			if (getCheckbox(child)) {
				return false;
			}
			const constructor = registry.get(child.localName);
			return constructor === undefined
				? child.localName.includes("-")
				: Object.prototype.isPrototypeOf.call(CheckboxElement.prototype, constructor.prototype);
		});
	}

	#resolveValues(values: ReadonlySet<string>, members: readonly CheckboxHandle[]): Set<CheckboxHandle> {
		const snapshot = this.#snapshotFrom(members);
		const selectable = this.#selectableMembers(snapshot.members);
		const selected = new Set<CheckboxHandle>();
		for (const value of values) {
			const matches = selectable.filter((member) => member.value === value);
			if (matches.length !== 1) {
				throw new TypeError(
					`Checkbox group value ${JSON.stringify(value)} does not identify exactly one direct checkbox`,
				);
			}
			selected.add(matches[0].handle);
		}
		return selected;
	}

	#synchronizeState(): void {
		this.#internals.ariaDisabled = String(this.disabled);
		if (this.disabled) {
			this.#internals.states.add("disabled");
		} else {
			this.#internals.states.delete("disabled");
		}
	}
}

/** Typed event listeners available on checkbox group elements. */
export interface CheckboxGroupElement {
	addEventListener<Type extends keyof CheckboxGroupEventMap>(
		type: Type,
		listener: (this: CheckboxGroupElement, event: CheckboxGroupEventMap[Type]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;

	removeEventListener<Type extends keyof CheckboxGroupEventMap>(
		type: Type,
		listener: (this: CheckboxGroupElement, event: CheckboxGroupEventMap[Type]) => unknown,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void;
}
