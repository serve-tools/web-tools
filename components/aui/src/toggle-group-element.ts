import type { ToggleGroupController, ToggleHandle } from "./.toggle-group.js";
import { getToggle, registerToggleGroup } from "./.toggle-group.js";
import { AUIElement } from "./aui-element.js";
import type { ToggleChangeDetail, ToggleElement } from "./toggle-element.js";

/** The axis used for toggle-group keyboard navigation. */
export type ToggleGroupOrientation = "horizontal" | "vertical";

/** Immutable full selection proposed by a toggle group's `beforechange` event. */
export interface ToggleGroupChangeDetail {
	/** The selected values that will be committed unless the transaction is canceled. */
	readonly values: readonly string[];

	/** The direct toggle that initiated this transaction. */
	readonly sourceToggle: ToggleElement;

	/** The native button click that proposed the transition. */
	readonly sourceEvent: MouseEvent;
}

/** Events emitted by a toggle group. Child toggle proposals also bubble through the group. */
export interface ToggleGroupEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<ToggleChangeDetail | ToggleGroupChangeDetail>;
}

interface MemberSnapshot {
	readonly button: HTMLButtonElement | null;
	readonly disabled: boolean;
	readonly handle: ToggleHandle;
	readonly hasValue: boolean;
	readonly pressed: boolean;
	readonly value: string;
}

interface GroupSnapshot {
	readonly disabled: boolean;
	readonly members: readonly MemberSnapshot[];
	readonly multiple: boolean;
}

const isElement = (value: unknown): value is Element =>
	typeof value === "object" && value !== null && "nodeType" in value && (value as Node).nodeType === 1;

/** Coordinates the pressed values and roving focus of direct child toggle elements. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the interface adds typed DOM event overloads only.
export class ToggleGroupElement extends AUIElement {
	static readonly observedAttributes = ["disabled", "loop-focus", "multiple", "orientation"];

	#active: ToggleHandle | undefined;
	#changing = false;
	#connected = false;
	readonly #controller: ToggleGroupController;
	#focused: ToggleHandle | undefined;
	#internals = this.attachInternals();
	#members: ToggleHandle[] = [];
	#pendingValues: readonly string[] | undefined;
	#refreshing = false;

	constructor() {
		super();

		this.#internals.role = "group";
		const element = this;
		this.#controller = {
			get changing() {
				return element.#changing;
			},
			activate(toggle, pressed, sourceEvent, notify) {
				return element.#activate(toggle, pressed, sourceEvent, notify);
			},
			has(toggle) {
				if (toggle.element.parentElement !== element || getToggle(toggle.element) !== toggle) {
					return false;
				}
				element.#refresh();
				return element.#members.includes(toggle);
			},
			memberChanged(toggle) {
				if (toggle.element.parentElement === element) {
					element.#refresh();
				}
			},
			setPressed(toggle, pressed) {
				element.#setMemberPressed(toggle, pressed);
			},
		};
		for (const property of ["disabled", "loopFocus", "multiple", "orientation", "values"] as const) {
			this.#upgradeProperty(property);
		}

		this.#synchronizeStates();
		registerToggleGroup(this, this.#controller);
		this.#refresh();
	}

	/** A frozen DOM-order snapshot of the pressed direct-child values. */
	get values(): readonly string[] {
		this.#refresh();
		return this.#pendingValues ?? Object.freeze(this.#currentValues());
	}

	set values(values: readonly string[]) {
		if (!Array.isArray(values)) {
			throw new TypeError("Toggle group values must be an array of strings");
		}
		this.#setValues(values);
	}

	/** Whether more than one toggle may be pressed. */
	get multiple(): boolean {
		return this.hasAttribute("multiple");
	}

	set multiple(value: boolean) {
		this.toggleAttribute("multiple", Boolean(value));
	}

	/** Whether the group disables every direct toggle without changing each toggle's own disabled property. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** The axis used by arrow-key focus navigation. Invalid values read as `horizontal`. */
	get orientation(): ToggleGroupOrientation {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
	}

	set orientation(value: ToggleGroupOrientation) {
		this.setAttribute("orientation", value === "vertical" ? "vertical" : "horizontal");
	}

	/** Whether arrow-key focus wraps at either end. Defaults to true. */
	get loopFocus(): boolean {
		return this.getAttribute("loop-focus") !== "false";
	}

	set loopFocus(value: boolean) {
		this.setAttribute("loop-focus", String(Boolean(value)));
	}

	attributeChangedCallback(): void {
		this.#synchronizeStates();
		this.#refresh();
	}

	protected connect(connection: AUIElement.Connection): void {
		this.#connected = true;
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("keydown", this.#onKeyDown, { signal: connection.signal });
		this.ownerDocument.addEventListener("focusin", this.#onDocumentFocusIn, {
			capture: true,
			signal: connection.signal,
		});

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: ["aria-pressed", "disabled", "pressed", "tabindex", "value"],
			attributes: true,
			childList: true,
			subtree: true,
		});

		connection.addCleanup(() => {
			observer.disconnect();
			this.#connected = false;
			for (const member of this.#members) {
				if (member.element.parentElement === this && getToggle(member.element) === member) {
					member.setGroupDisabled(this.#controller, this.disabled);
					member.setGroupTabIndex(this.#controller, undefined);
				} else {
					member.releaseGroup(this.#controller);
				}
			}
			this.#active = undefined;
			this.#focused = undefined;
			this.#members = [];
		});

		this.#refresh();
	}

	#onDocumentFocusIn = (event: FocusEvent): void => {
		this.#focused = this.#memberForTarget(event.target);
	};

	#onFocusIn = (event: FocusEvent): void => {
		const member = this.#memberForTarget(event.target);
		if (!member || member.disabled) {
			return;
		}
		this.#focused = member;
		this.#active = member;
		this.#synchronizeRovingFocus();
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}

		this.#refresh();
		const currentMember = this.#memberForTarget(event.target);
		if (!currentMember || currentMember.disabled) {
			return;
		}

		const enabled = this.#members.filter((member) => !member.disabled && member.button);
		const currentIndex = enabled.indexOf(currentMember);
		if (currentIndex < 0) {
			return;
		}

		let nextIndex: number | undefined;
		if (event.key === "Home") {
			nextIndex = 0;
		} else if (event.key === "End") {
			nextIndex = enabled.length - 1;
		} else if (this.orientation === "vertical") {
			if (event.key === "ArrowDown") {
				nextIndex = currentIndex + 1;
			} else if (event.key === "ArrowUp") {
				nextIndex = currentIndex - 1;
			}
		} else {
			const direction = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl" ? -1 : 1;
			if (event.key === "ArrowRight") {
				nextIndex = currentIndex + direction;
			} else if (event.key === "ArrowLeft") {
				nextIndex = currentIndex - direction;
			}
		}

		if (nextIndex === undefined) {
			return;
		}
		if (this.loopFocus) {
			nextIndex = (nextIndex + enabled.length) % enabled.length;
		} else if (nextIndex < 0 || nextIndex >= enabled.length) {
			return;
		}

		const next = enabled[nextIndex];
		const button = next?.button;
		if (!next || !button) {
			return;
		}

		event.preventDefault();
		this.#active = next;
		this.#synchronizeRovingFocus();
		button.focus();
	};

	#activate(toggle: ToggleHandle, pressed: boolean, sourceEvent: MouseEvent, notify: () => void): boolean {
		if (this.#changing) {
			return false;
		}

		this.#refresh();
		const before = this.#snapshot();
		const source = before.members.find((member) => member.handle === toggle);
		if (
			!source ||
			source.disabled ||
			source.pressed === pressed ||
			!this.#isUniqueValue(source.value, before.members, source.hasValue)
		) {
			return false;
		}

		const selected = new Set(before.members.filter((member) => member.pressed).map((member) => member.handle));
		if (this.multiple) {
			if (pressed) {
				selected.add(toggle);
			} else {
				selected.delete(toggle);
			}
		} else if (pressed) {
			selected.clear();
			selected.add(toggle);
		} else {
			selected.delete(toggle);
		}

		const values = Object.freeze(
			before.members.filter((member) => selected.has(member.handle)).map((member) => member.value),
		);
		const detail = Object.freeze({
			values,
			sourceToggle: toggle.element as ToggleElement,
			sourceEvent,
		}) satisfies ToggleGroupChangeDetail;
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<ToggleGroupChangeDetail>("beforechange", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail,
		});

		this.#changing = true;
		try {
			if (!this.dispatchEvent(proposal) || !this.#snapshotEquals(before, this.#snapshot())) {
				return false;
			}

			this.#commit(selected);
			notify();
			return true;
		} finally {
			this.#changing = false;
		}
	}

	#setMemberPressed(toggle: ToggleHandle, pressed: boolean): void {
		this.#refresh();
		if (!this.#members.includes(toggle) || toggle.element.parentElement !== this) {
			toggle.setPressed(pressed);
			return;
		}
		if (toggle.pressed === pressed) {
			return;
		}

		if (pressed && !this.#isUniqueValue(toggle.value, this.#snapshot().members, toggle.hasValue)) {
			throw new TypeError("A pressed toggle group member requires an explicit unique value attribute");
		}

		this.#pendingValues = undefined;
		const selected = new Set(this.#members.filter((member) => member.pressed));
		if (this.multiple) {
			if (pressed) {
				selected.add(toggle);
			} else {
				selected.delete(toggle);
			}
		} else if (pressed) {
			selected.clear();
			selected.add(toggle);
		} else {
			selected.delete(toggle);
		}
		this.#commit(selected);
	}

	#setValues(values: readonly string[]): void {
		this.#refresh();
		if (!this.multiple && values.length > 1) {
			throw new RangeError("A single toggle group accepts at most one value");
		}

		const requested = new Set<string>();
		for (const value of values) {
			if (typeof value !== "string" || requested.has(value)) {
				throw new TypeError("Toggle group values must be unique strings");
			}
			requested.add(value);
		}
		if (this.#members.length === 0 && requested.size > 0) {
			this.#pendingValues = Object.freeze([...requested]);
			return;
		}

		const selected = new Set<ToggleHandle>();
		for (const value of requested) {
			const matches = this.#members.filter((member) => member.hasValue && member.value === value);
			if (matches.length !== 1) {
				throw new TypeError(
					`Toggle group value ${JSON.stringify(value)} does not identify exactly one direct toggle`,
				);
			}
			selected.add(matches[0]);
		}

		this.#commit(selected);
	}

	#commit(selected: ReadonlySet<ToggleHandle>): void {
		this.#pendingValues = undefined;
		for (const member of this.#members) {
			member.setPressed(selected.has(member));
		}
		this.#synchronizeRovingFocus();
	}

	#applyPendingValues(): void {
		const pending = this.#pendingValues;
		if (!pending || this.#members.length === 0) {
			return;
		}

		const values = this.multiple ? pending : pending.slice(0, 1);
		if (values !== pending) {
			this.#pendingValues = Object.freeze(values);
		}

		const selected = new Set<ToggleHandle>();
		for (const value of values) {
			const matches = this.#members.filter((member) => member.hasValue && member.value === value);
			if (matches.length !== 1) {
				return;
			}
			selected.add(matches[0]);
		}

		this.#commit(selected);
	}

	#refresh(): void {
		if (this.#refreshing) {
			return;
		}
		this.#refreshing = true;

		try {
			const previousMembers = this.#members;
			const previousActive = this.#active;
			const previousActiveButton = previousActive?.button;
			const members = [...this.children].map(getToggle).filter((member) => member !== undefined);
			this.#members = members;

			const counts = new Map<string, number>();
			for (const member of members) {
				if (member.hasValue) {
					counts.set(member.value, (counts.get(member.value) ?? 0) + 1);
				}
			}

			let selected = false;
			for (const member of members) {
				member.setGroupDisabled(this.#controller, this.disabled);
				const valid = member.hasValue && counts.get(member.value) === 1;
				const keepPressed = member.pressed && valid && (this.multiple || !selected);
				if (keepPressed) {
					selected = true;
				} else if (member.pressed) {
					member.setPressed(false);
				}
			}

			for (const member of previousMembers) {
				if (!members.includes(member)) {
					member.releaseGroup(this.#controller);
				}
			}

			if (
				previousActive &&
				(!members.includes(previousActive) || previousActive.disabled || !previousActive.button)
			) {
				const previousIndex = previousMembers.indexOf(previousActive);
				const nextIndex = members.includes(previousActive)
					? members.indexOf(previousActive) + 1
					: Math.min(Math.max(previousIndex, 0), members.length);
				this.#active =
					members.slice(nextIndex).find((member) => !member.disabled && member.button) ??
					members.slice(0, nextIndex).findLast((member) => !member.disabled && member.button);
			}

			if (!this.#active) {
				this.#active =
					members.find((member) => member.pressed && !member.disabled && member.button) ??
					members.find((member) => !member.disabled && member.button);
			}

			this.#synchronizeRovingFocus();
			this.#applyPendingValues();
			const activeButton = this.#active?.button;
			if (
				previousActive &&
				previousActive === this.#focused &&
				(previousActive !== this.#active || previousActiveButton !== activeButton) &&
				activeButton &&
				this.isConnected
			) {
				activeButton.focus();
			}
		} finally {
			this.#refreshing = false;
		}
	}

	#synchronizeRovingFocus(): void {
		for (const member of this.#members) {
			member.setGroupDisabled(this.#controller, this.disabled);
			member.setGroupTabIndex(
				this.#controller,
				this.#connected ? (member === this.#active && !member.disabled ? "0" : "-1") : undefined,
			);
		}
	}

	#memberForTarget(target: EventTarget | null): ToggleHandle | undefined {
		if (!isElement(target)) {
			return;
		}
		return this.#members.find((member) => member.button === target);
	}

	#snapshot(): GroupSnapshot {
		const members = [...this.children].map(getToggle).filter((member) => member !== undefined);
		return {
			disabled: this.disabled,
			members: members.map((handle) => ({
				button: handle.button,
				disabled: handle.disabled,
				handle,
				hasValue: handle.hasValue,
				pressed: handle.pressed,
				value: handle.value,
			})),
			multiple: this.multiple,
		};
	}

	#snapshotEquals(left: GroupSnapshot, right: GroupSnapshot): boolean {
		if (
			left.disabled !== right.disabled ||
			left.multiple !== right.multiple ||
			left.members.length !== right.members.length
		) {
			return false;
		}

		return left.members.every((member, index) => {
			const other = right.members[index];
			return (
				member.button === other.button &&
				member.disabled === other.disabled &&
				member.handle === other.handle &&
				member.hasValue === other.hasValue &&
				member.pressed === other.pressed &&
				member.value === other.value
			);
		});
	}

	#currentValues(): string[] {
		return this.#members.filter((member) => member.pressed).map((member) => member.value);
	}

	#isUniqueValue(value: string, members: readonly MemberSnapshot[], hasValue = true): boolean {
		return hasValue && members.filter((member) => member.hasValue && member.value === value).length === 1;
	}

	#synchronizeStates(): void {
		this.#setState("disabled", this.disabled);
		this.#setState("multiple", this.multiple);
		this.#setState("horizontal", this.orientation === "horizontal");
		this.#setState("vertical", this.orientation === "vertical");
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
	}

	#upgradeProperty(property: "disabled" | "loopFocus" | "multiple" | "orientation" | "values"): void {
		if (!Object.hasOwn(this, property)) {
			return;
		}
		const value = this[property];
		delete (this as Partial<Record<typeof property, unknown>>)[property];
		(this as Record<typeof property, unknown>)[property] = value;
	}
}

/** Typed event listeners available on toggle-group elements. */
export interface ToggleGroupElement {
	addEventListener<Type extends keyof ToggleGroupEventMap>(
		type: Type,
		listener: (this: ToggleGroupElement, event: ToggleGroupEventMap[Type]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;

	removeEventListener<Type extends keyof ToggleGroupEventMap>(
		type: Type,
		listener: (this: ToggleGroupElement, event: ToggleGroupEventMap[Type]) => unknown,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void;
}
