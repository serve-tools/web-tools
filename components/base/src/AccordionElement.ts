import type { AccordionActivation, AccordionController, DisclosureHandle } from "./_disclosure.js";
import { getDisclosure, registerAccordion } from "./_disclosure.js";
import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";
import type { CollapsibleChangeDetail, CollapsibleElement } from "./CollapsibleElement.js";

/** The axis used for accordion keyboard navigation. */
export type AccordionOrientation = "horizontal" | "vertical";

/** Immutable full expansion proposed by an accordion's `beforechange` event. */
export interface AccordionChangeDetail {
	/** The open values that will be committed unless the transaction is canceled. */
	readonly values: readonly string[];

	/** The direct disclosure that initiated this transaction. */
	readonly sourceDisclosure: CollapsibleElement;

	/** The native button click that proposed the transition. */
	readonly sourceEvent: MouseEvent;
}

/** Events observable on an accordion. Direct collapsible proposals also bubble through it. */
export interface AccordionEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<AccordionChangeDetail | CollapsibleChangeDetail>;
}

interface MemberSnapshot {
	readonly button: HTMLButtonElement | null;
	readonly disabled: boolean;
	readonly handle: DisclosureHandle;
	readonly hasValue: boolean;
	readonly open: boolean;
	readonly value: string;
}

interface GroupSnapshot {
	readonly disabled: boolean;
	readonly members: readonly MemberSnapshot[];
	readonly multiple: boolean;
}

const isElement = (value: unknown): value is Element =>
	typeof value === "object" && value !== null && "nodeType" in value && (value as Node).nodeType === 1;

/** Coordinates expansion and keyboard focus for direct child collapsibles. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the interface adds typed DOM event overloads only.
export class AccordionElement extends BaseElement {
	static readonly observedAttributes = ["disabled", "loop-focus", "multiple", "orientation"];

	#activation: AccordionActivation | undefined;
	readonly #controller: AccordionController;
	#internals = this.attachInternals();
	#members: DisclosureHandle[] = [];
	#pendingValues: readonly string[] | undefined;
	#recoveringProperties = true;
	#refreshing = false;
	#revision = 0;

	constructor() {
		super();

		const element = this;
		this.#controller = {
			get changing() {
				return element.#activation !== undefined;
			},
			get revision() {
				return element.#revision;
			},
			activate(activation, disclosure, open, sourceEvent, notify) {
				return element.#activate(activation, disclosure, open, sourceEvent, notify);
			},
			beginActivation(disclosure) {
				return element.#beginActivation(disclosure);
			},
			endActivation(activation) {
				element.#endActivation(activation);
			},
			has(disclosure) {
				if (disclosure.element.parentElement !== element || getDisclosure(disclosure.element) !== disclosure) {
					return false;
				}
				element.#refresh();
				return element.#members.includes(disclosure);
			},
			memberChanged(disclosure) {
				if (disclosure.element.parentElement === element) {
					++element.#revision;
					element.#refresh();
				}
			},
			setOpen(disclosure, open) {
				element.#setMemberOpen(disclosure, open);
			},
		};

		for (const property of ["disabled", "loopFocus", "multiple", "orientation", "values"] as const) {
			upgradeProperty(this, property);
		}
		this.#recoveringProperties = false;

		this.#synchronizeStates();
		registerAccordion(this, this.#controller);
		this.#refresh();
	}

	/** A frozen DOM-order snapshot of the upgraded direct child disclosures. */
	get disclosures(): readonly CollapsibleElement[] {
		this.#refresh();
		return Object.freeze(this.#members.map((member) => member.element as CollapsibleElement));
	}

	/** A frozen DOM-order snapshot of the open direct-child values. */
	get values(): readonly string[] {
		this.#refresh();
		return this.#pendingValues ?? Object.freeze(this.#currentValues());
	}

	set values(values: readonly string[]) {
		if (!Array.isArray(values)) {
			throw new TypeError("Accordion values must be an array of strings");
		}
		this.#setValues(values);
	}

	/** Whether more than one disclosure may be open. */
	get multiple(): boolean {
		return this.hasAttribute("multiple");
	}

	set multiple(value: boolean) {
		this.toggleAttribute("multiple", Boolean(value));
	}

	/** Whether the accordion disables every direct disclosure without changing each one's own disabled property. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** The axis used by arrow-key focus navigation. Invalid values read as `vertical`. */
	get orientation(): AccordionOrientation {
		return this.getAttribute("orientation") === "horizontal" ? "horizontal" : "vertical";
	}

	set orientation(value: AccordionOrientation) {
		this.setAttribute("orientation", value === "horizontal" ? "horizontal" : "vertical");
	}

	/** Whether arrow-key focus wraps at either end. Defaults to true. */
	get loopFocus(): boolean {
		return this.getAttribute("loop-focus") !== "false";
	}

	set loopFocus(value: boolean) {
		this.setAttribute("loop-focus", String(Boolean(value)));
	}

	attributeChangedCallback(): void {
		++this.#revision;
		this.#synchronizeStates();
		if (!this.#recoveringProperties) {
			this.#refresh();
		}
	}

	protected connect(connection: BaseElement.Connection): void {
		this.addEventListener("keydown", this.#onKeyDown, { signal: connection.signal });

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, { childList: true });
		connection.addCleanup(() => {
			observer.disconnect();
			++this.#revision;
			this.#members = [];
		});

		this.#refresh();
	}

	protected moved(): void {
		this.#refresh();
	}

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

		if (nextIndex === undefined || enabled.length === 0) {
			return;
		}
		if (this.loopFocus) {
			nextIndex = (nextIndex + enabled.length) % enabled.length;
		} else if (nextIndex < 0 || nextIndex >= enabled.length) {
			return;
		}

		const button = enabled[nextIndex]?.button;
		if (!button) {
			return;
		}

		event.preventDefault();
		button.focus();
	};

	#beginActivation(disclosure: DisclosureHandle): AccordionActivation | undefined {
		if (this.#activation) {
			return;
		}
		this.#refresh();
		if (!this.#members.includes(disclosure) || disclosure.element.parentElement !== this) {
			return;
		}

		const activation = Object.freeze({ revision: this.#revision });
		this.#activation = activation;
		return activation;
	}

	#endActivation(activation: AccordionActivation): void {
		if (this.#activation === activation) {
			this.#activation = undefined;
		}
	}

	#activate(
		activation: AccordionActivation,
		disclosure: DisclosureHandle,
		open: boolean,
		sourceEvent: MouseEvent,
		notify: () => void,
	): boolean {
		if (this.#activation !== activation || activation.revision !== this.#revision) {
			return false;
		}

		this.#refresh();
		const before = this.#snapshot();
		const source = before.members.find((member) => member.handle === disclosure);
		if (
			!source ||
			source.disabled ||
			source.open === open ||
			!this.#isUniqueValue(source.value, before.members, source.hasValue)
		) {
			return false;
		}

		const expanded = new Set(before.members.filter((member) => member.open).map((member) => member.handle));
		if (this.multiple) {
			if (open) {
				expanded.add(disclosure);
			} else {
				expanded.delete(disclosure);
			}
		} else if (open) {
			expanded.clear();
			expanded.add(disclosure);
		} else {
			expanded.delete(disclosure);
		}

		const values = Object.freeze(
			before.members.filter((member) => expanded.has(member.handle)).map((member) => member.value),
		);
		const detail = Object.freeze({
			values,
			sourceDisclosure: disclosure.element as CollapsibleElement,
			sourceEvent,
		}) satisfies AccordionChangeDetail;
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<AccordionChangeDetail>("beforechange", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail,
		});

		if (
			!this.dispatchEvent(proposal) ||
			activation.revision !== this.#revision ||
			!this.#snapshotEquals(before, this.#snapshot())
		) {
			return false;
		}

		if (!this.#commit(expanded)) {
			return false;
		}
		notify();
		return true;
	}

	#setMemberOpen(disclosure: DisclosureHandle, open: boolean): void {
		this.#refresh();
		if (!this.#members.includes(disclosure) || disclosure.element.parentElement !== this) {
			disclosure.setOpen(open);
			return;
		}
		if (disclosure.open === open) {
			return;
		}

		if (open && !this.#isUniqueValue(disclosure.value, this.#snapshot().members, disclosure.hasValue)) {
			throw new TypeError("An open accordion disclosure requires an explicit unique value attribute");
		}

		this.#pendingValues = undefined;
		const expanded = new Set(this.#members.filter((member) => member.open));
		if (this.multiple) {
			if (open) {
				expanded.add(disclosure);
			} else {
				expanded.delete(disclosure);
			}
		} else if (open) {
			expanded.clear();
			expanded.add(disclosure);
		} else {
			expanded.delete(disclosure);
		}
		this.#commit(expanded);
	}

	#setValues(values: readonly string[]): void {
		if (!this.multiple && values.length > 1) {
			throw new RangeError("A single accordion accepts at most one value");
		}

		const requested = new Set<string>();
		for (const value of values) {
			if (typeof value !== "string" || requested.has(value)) {
				throw new TypeError("Accordion values must be unique strings");
			}
			requested.add(value);
		}

		const members = [...this.children].map(getDisclosure).filter((member) => member !== undefined);
		if (members.length === 0 && requested.size > 0) {
			this.#pendingValues = Object.freeze([...requested]);
			return;
		}

		const expanded = new Set<DisclosureHandle>();
		for (const value of requested) {
			const matches = members.filter((member) => member.hasValue && member.value === value);
			if (matches.length !== 1) {
				throw new TypeError(
					`Accordion value ${JSON.stringify(value)} does not identify exactly one direct disclosure`,
				);
			}
			expanded.add(matches[0]);
		}
		if (this.#recoveringProperties) {
			this.#pendingValues = Object.freeze([...requested]);
			return;
		}

		this.#refresh();
		this.#commit(expanded);
	}

	#commit(expanded: ReadonlySet<DisclosureHandle>): boolean {
		const revision = ++this.#revision;
		const members = [...this.#members];
		this.#pendingValues = undefined;
		for (const member of members) {
			member.setOpen(expanded.has(member));
			if (this.#revision !== revision || !this.#membershipIntact(members)) {
				return false;
			}
		}

		return true;
	}

	#membershipIntact(expected: readonly DisclosureHandle[]): boolean {
		const current = [...this.children].map(getDisclosure).filter((member) => member !== undefined);
		return current.length === expected.length && current.every((member, index) => member === expected[index]);
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

		const expanded = new Set<DisclosureHandle>();
		for (const value of values) {
			const matches = this.#members.filter((member) => member.hasValue && member.value === value);
			if (matches.length !== 1) {
				return;
			}
			expanded.add(matches[0]);
		}

		this.#commit(expanded);
	}

	#refresh(): void {
		if (this.#refreshing) {
			return;
		}
		this.#refreshing = true;

		try {
			const previousMembers = this.#members;
			const members = [...this.children].map(getDisclosure).filter((member) => member !== undefined);
			this.#members = members;
			if (
				previousMembers.length !== members.length ||
				previousMembers.some((member, index) => member !== members[index])
			) {
				++this.#revision;
			}

			const counts = new Map<string, number>();
			for (const member of members) {
				if (member.hasValue) {
					counts.set(member.value, (counts.get(member.value) ?? 0) + 1);
				}
			}

			let expanded = false;
			for (const member of members) {
				const valid = member.hasValue && counts.get(member.value) === 1;
				member.setAccordionDisabled(this.#controller, this.disabled || !valid);
				const keepOpen = member.open && valid && (this.multiple || !expanded);
				if (keepOpen) {
					expanded = true;
				} else if (member.open) {
					member.setOpen(false);
				}
			}

			for (const member of previousMembers) {
				if (!members.includes(member)) {
					member.releaseAccordion(this.#controller);
				}
			}

			this.#applyPendingValues();
		} finally {
			this.#refreshing = false;
		}
	}

	#memberForTarget(target: EventTarget | null): DisclosureHandle | undefined {
		if (!isElement(target)) {
			return;
		}
		return this.#members.find((member) => member.button === target);
	}

	#snapshot(): GroupSnapshot {
		const members = [...this.children].map(getDisclosure).filter((member) => member !== undefined);
		return {
			disabled: this.disabled,
			members: members.map((handle) => ({
				button: handle.button,
				disabled: handle.disabled,
				handle,
				hasValue: handle.hasValue,
				open: handle.open,
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
				member.open === other.open &&
				member.value === other.value
			);
		});
	}

	#currentValues(): string[] {
		return this.#members.filter((member) => member.open).map((member) => member.value);
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
}

/** Typed event listeners available on accordion elements. */
export interface AccordionElement {
	addEventListener<Type extends keyof AccordionEventMap>(
		type: Type,
		listener: (this: AccordionElement, event: AccordionEventMap[Type]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;

	removeEventListener<Type extends keyof AccordionEventMap>(
		type: Type,
		listener: (this: AccordionElement, event: AccordionEventMap[Type]) => unknown,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void;
}
