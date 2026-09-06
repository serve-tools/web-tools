import { nextEnabledOption, setListboxState } from "./_listbox.js";
import { AttributeOwner } from "./_ownership.js";
import type { SelectionOwner } from "./_selection.js";
import { invalidateSelectionId, ownSelectionId, ownsOption, registerSelectionOwner } from "./_selection.js";
import { BaseElement } from "./BaseElement.js";
import { OptionElement } from "./OptionElement.js";

/** Immutable native-input value proposed by accepting an autocomplete option. */
export interface AutocompleteChangeDetail {
	/** The label that will become the native input's submitted string. */
	readonly value: string;
	readonly values: readonly [string];
	/** The option's explicit collection identity, separate from the submitted text. */
	readonly optionValue: string;
	readonly sourceEvent: Event;
}

export interface AutocompleteEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<AutocompleteChangeDetail>;
}

interface OptionRecord {
	readonly disabled: boolean;
	readonly hidden: boolean | "until-found";
	readonly invalid: boolean;
	readonly label: string;
	readonly option: OptionElement;
	readonly value: string;
}

interface AutocompleteSnapshot {
	readonly connected: object | undefined;
	readonly disabled: boolean;
	readonly document: Document;
	readonly form: HTMLFormElement | null;
	readonly input: HTMLInputElement | null;
	readonly inputValue: string;
	readonly isConnected: boolean;
	readonly options: readonly OptionRecord[];
	readonly popup: HTMLElement | null;
	readonly readOnly: boolean;
	readonly revision: number;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";

const isInput = (element: Element): element is HTMLInputElement =>
	element.namespaceURI === htmlNamespace && element.localName === "input";
const isHTMLElement = (element: Element): element is HTMLElement => element.namespaceURI === htmlNamespace;

/** A suggestion controller that leaves one authored native input as form and focus owner. */
export class AutocompleteElement extends BaseElement {
	#active: OptionElement | undefined;
	#attributes = new AttributeOwner();
	#boundInput: HTMLInputElement | undefined;
	#changing = false;
	#connected: object | undefined;
	#filteredOptions = new Set<OptionElement>();
	#inputAbort: AbortController | undefined;
	#invalidOptions = new Set<OptionElement>();
	readonly #owner: SelectionOwner;
	#ownedPopup: HTMLElement | undefined;
	#query = "";
	#records: readonly OptionRecord[] = [];
	#refreshing = false;
	#revision = 0;

	declare addEventListener: {
		<Type extends keyof AutocompleteEventMap>(
			type: Type,
			listener: (this: AutocompleteElement, event: AutocompleteEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};

	declare removeEventListener: {
		<Type extends keyof AutocompleteEventMap>(
			type: Type,
			listener: (this: AutocompleteElement, event: AutocompleteEventMap[Type]) => unknown,
			options?: boolean | EventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | EventListenerOptions,
		): void;
	};

	constructor() {
		super();
		const element = this;
		this.#owner = {
			element: this,
			membershipChanged() {
				++element.#revision;
				element.#refresh();
			},
			setOptionSelected() {
				return false;
			},
		};
		registerSelectionOwner(this.#owner);
	}

	get input(): HTMLInputElement | null {
		return [...this.children].find(isInput) ?? null;
	}

	get popup(): HTMLElement | null {
		return (
			[...this.children].find(
				(child): child is HTMLElement => isHTMLElement(child) && child.hasAttribute("popover"),
			) ?? null
		);
	}

	/** Reconciles silent native input, popup, option, and external-ID changes. */
	refresh(): void {
		const popup = this.popup;
		if (popup) {
			invalidateSelectionId(popup);
		}
		for (const record of this.#records) {
			invalidateSelectionId(record.option);
		}
		++this.#revision;
		this.#refresh();
	}

	protected connect(connection: BaseElement.Connection): void {
		const connected = {};
		this.#connected = connected;
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: [
				"aria-activedescendant",
				"aria-controls",
				"aria-disabled",
				"aria-expanded",
				"aria-multiselectable",
				"data-filtered",
				"disabled",
				"hidden",
				"id",
				"label",
				"popover",
				"role",
				"selected",
				"value",
			],
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true,
		});
		this.addEventListener("click", this.#onClick, { signal: connection.signal });
		this.addEventListener("toggle", this.#onToggle, { capture: true, signal: connection.signal });
		connection.addCleanup(() => {
			observer.disconnect();
			if (this.#connected !== connected) {
				return;
			}
			this.#connected = undefined;
			++this.#revision;
			this.#releaseInput();
			this.#releasePopup();
			this.#releaseFilteredOptions();
			this.#active = undefined;
			this.#records = [];
		});
		this.#refresh();
	}

	protected moved(): void {
		++this.#revision;
		this.#refresh();
	}

	#onClick = (event: MouseEvent): void => {
		if (this.#changing || event.defaultPrevented) {
			return;
		}
		this.#refresh();
		const input = this.input;
		if (!input || input.matches(":disabled") || input.readOnly) {
			return;
		}
		const option = event.composedPath().find((target): target is OptionElement => target instanceof OptionElement);
		const record = option && this.#record(option);
		if (record && this.#eligible(record)) {
			this.#accept(record, event);
		}
	};

	#onToggle = (event: ToggleEvent): void => {
		if (event.target !== this.popup) {
			return;
		}
		++this.#revision;
		if (event.newState === "closed") {
			this.#active = undefined;
		}
		this.#synchronize();
	};

	#bindInput(input: HTMLInputElement): void {
		if (input !== this.#boundInput) {
			this.#releaseInput();
			this.#boundInput = input;
			this.#synchronizeQuery(input.value);
			const Controller = this.ownerDocument.defaultView?.AbortController ?? AbortController;
			this.#inputAbort = new Controller();
			let composing = false;
			input.addEventListener("compositionstart", () => (composing = true), { signal: this.#inputAbort.signal });
			input.addEventListener(
				"compositionend",
				() => {
					composing = false;
					this.#filter(input.value);
					if (input.value) {
						this.#showPopup(input);
					}
				},
				{ signal: this.#inputAbort.signal },
			);
			input.ownerDocument.addEventListener(
				"reset",
				(event) => {
					if (event.target !== input.form) {
						return;
					}
					queueMicrotask(() => {
						if (this.#connected && this.#boundInput === input) {
							this.#synchronizeQuery(input.value);
							this.#refresh();
						}
					});
				},
				{ capture: true, signal: this.#inputAbort.signal },
			);
			input.addEventListener(
				"input",
				() => {
					if (this.#changing || composing || input.matches(":disabled") || input.readOnly) {
						return;
					}
					this.#filter(input.value);
					if (input.value) {
						this.#showPopup(input);
					}
				},
				{ signal: this.#inputAbort.signal },
			);
			input.addEventListener(
				"keydown",
				(event) => {
					if (
						event.defaultPrevented ||
						composing ||
						event.isComposing ||
						event.keyCode === 229 ||
						input.matches(":disabled") ||
						input.readOnly
					) {
						return;
					}
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						if (this.#showPopup(input)) {
							this.#moveActive(event.key === "ArrowDown" ? 1 : -1);
						}
					} else if (event.key === "Escape") {
						this.#hidePopup();
					} else if (event.key === "Enter") {
						this.#refresh();
						const popup = this.popup;
						const record = this.#active && this.#record(this.#active);
						if (popup?.matches(":popover-open") && record && this.#eligible(record)) {
							event.preventDefault();
							this.#accept(record, event);
						}
					}
				},
				{ signal: this.#inputAbort.signal },
			);
			++this.#revision;
		}
	}

	#releaseInput(): void {
		this.#inputAbort?.abort();
		this.#inputAbort = undefined;
		if (this.#boundInput) {
			this.#attributes.release(this.#boundInput);
		}
		this.#boundInput = undefined;
	}

	#ownPopup(popup: HTMLElement): void {
		if (popup !== this.#ownedPopup) {
			this.#releasePopup();
			this.#ownedPopup = popup;
			++this.#revision;
		}
		this.#attributes.own(popup, "popover", "auto");
	}

	#releasePopup(): void {
		if (this.#ownedPopup) {
			this.#attributes.release(this.#ownedPopup);
		}
		this.#ownedPopup = undefined;
	}

	#filter(query: string): void {
		this.#synchronizeQuery(query);
		this.#refresh();
	}

	#synchronizeQuery(query: string): void {
		const normalized = query.trim().toLocaleLowerCase();
		if (normalized !== this.#query) {
			++this.#revision;
			this.#query = normalized;
		}
	}

	#applyFilter(options: readonly OptionElement[]): void {
		const current = new Set(options);
		for (const option of this.#filteredOptions) {
			if (!current.has(option)) {
				this.#attributes.releaseAttribute(option, "data-filtered");
				this.#attributes.releaseAttribute(option, "hidden");
			}
		}
		this.#filteredOptions.clear();
		for (const option of options) {
			const filtered = this.#query !== "" && !option.label.toLocaleLowerCase().includes(this.#query);
			if (filtered) {
				this.#attributes.authorValue(option, "hidden");
				this.#attributes.authorValue(option, "data-filtered");
				this.#attributes.own(option, "hidden", "");
				this.#attributes.own(option, "data-filtered", "");
				this.#filteredOptions.add(option);
			} else {
				this.#attributes.releaseAttribute(option, "data-filtered");
				this.#attributes.releaseAttribute(option, "hidden");
			}
		}
	}

	#releaseFilteredOptions(): void {
		for (const option of this.#filteredOptions) {
			this.#attributes.releaseAttribute(option, "data-filtered");
			this.#attributes.releaseAttribute(option, "hidden");
		}
		this.#filteredOptions.clear();
	}

	#accept(record: OptionRecord, sourceEvent: Event): void {
		if (this.#changing) {
			return;
		}
		this.#changing = true;
		try {
			const before = this.#snapshot();
			const values = Object.freeze([record.label] as const);
			const detail = Object.freeze({
				value: record.label,
				values,
				optionValue: record.value,
				sourceEvent,
			}) satisfies AutocompleteChangeDetail;
			const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
			const proposal = new EventConstructor<AutocompleteChangeDetail>("beforechange", {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail,
			});

			if (!this.dispatchEvent(proposal) || !this.#snapshotEquals(before, this.#snapshot())) {
				return;
			}
			const current = this.#record(record.option);
			const input = this.input;
			if (!input || !current || !this.#eligible(current)) {
				return;
			}
			++this.#revision;
			input.value = current.label;
			this.#hidePopup();
			this.#synchronize();
			const committed = this.#snapshot();
			const Constructor = this.ownerDocument.defaultView?.Event ?? Event;
			input.dispatchEvent(new Constructor("input", { bubbles: true, composed: true }));
			if (!this.#snapshotEquals(committed, this.#snapshot())) {
				return;
			}
			input.dispatchEvent(new Constructor("change", { bubbles: true }));
		} finally {
			this.#changing = false;
		}
	}

	#snapshot(): AutocompleteSnapshot {
		this.#refresh();
		const input = this.input;
		return {
			connected: this.#connected,
			disabled: input?.matches(":disabled") ?? false,
			document: this.ownerDocument,
			form: input?.form ?? null,
			input,
			inputValue: input?.value ?? "",
			isConnected: this.isConnected,
			options: this.#records.map((record) => ({ ...record })),
			popup: this.popup,
			readOnly: input?.readOnly ?? false,
			revision: this.#revision,
		};
	}

	#snapshotEquals(left: AutocompleteSnapshot, right: AutocompleteSnapshot): boolean {
		return (
			left.connected === right.connected &&
			left.disabled === right.disabled &&
			left.document === right.document &&
			left.form === right.form &&
			left.input === right.input &&
			left.inputValue === right.inputValue &&
			left.isConnected === right.isConnected &&
			left.popup === right.popup &&
			left.readOnly === right.readOnly &&
			left.revision === right.revision &&
			left.options.length === right.options.length &&
			left.options.every((record, index) => this.#sameRecord(record, right.options[index]))
		);
	}

	#sameRecord(left: OptionRecord, right: OptionRecord): boolean {
		return (
			left.disabled === right.disabled &&
			left.hidden === right.hidden &&
			left.invalid === right.invalid &&
			left.label === right.label &&
			left.option === right.option &&
			left.value === right.value
		);
	}

	#showPopup(source: HTMLInputElement): boolean {
		this.#synchronizeQuery(source.value);
		this.#refresh();
		const popup = this.popup;
		if (!popup) {
			return false;
		}
		if (!popup.matches(":popover-open")) {
			popup.showPopover({ source });
		}
		this.#synchronize();
		return popup.matches(":popover-open");
	}

	#hidePopup(): void {
		const popup = this.popup;
		if (popup?.matches(":popover-open")) {
			popup.hidePopover();
		}
	}

	#moveActive(delta: number): void {
		this.#refresh();
		const eligible = this.#records.filter((record) => this.#eligible(record)).map((record) => record.option);
		const active = nextEnabledOption(eligible, this.#active, delta);
		if (active !== this.#active) {
			++this.#revision;
			this.#active = active;
			this.#synchronize();
		}
	}

	#refresh(): void {
		if (this.#refreshing) {
			return;
		}
		this.#refreshing = true;
		try {
			const popup = this.popup;
			if (this.#connected) {
				const input = this.input;
				if (input) {
					this.#bindInput(input);
				} else {
					this.#releaseInput();
					this.#synchronizeQuery("");
				}
				if (popup) {
					this.#ownPopup(popup);
				} else {
					this.#releasePopup();
				}
			} else {
				this.#releaseInput();
				this.#releasePopup();
			}
			const options = popup
				? [...popup.querySelectorAll("*")].filter(
						(option): option is OptionElement =>
							option instanceof OptionElement && ownsOption(this, option),
					)
				: [];
			this.#applyFilter(options);
			const counts = new Map<string, number>();
			for (const option of options) {
				const value = option.getAttribute("value");
				if (value !== null) {
					counts.set(value, (counts.get(value) ?? 0) + 1);
				}
			}
			const records = options.map((option): OptionRecord => {
				const value = option.getAttribute("value");
				return {
					disabled: option.disabled,
					hidden: option.hidden,
					invalid: value === null || counts.get(value) !== 1,
					label: option.label,
					option,
					value: value ?? "",
				};
			});
			if (
				this.#records.length !== records.length ||
				this.#records.some((record, index) => !this.#sameRecord(record, records[index]))
			) {
				++this.#revision;
			}
			this.#records = records;
			this.#invalidOptions = new Set(records.filter((record) => record.invalid).map((record) => record.option));
			const active = this.#active && this.#record(this.#active);
			if (!active || !this.#eligible(active)) {
				if (this.#active) {
					++this.#revision;
				}
				this.#active = undefined;
			}

			this.#synchronize();
		} finally {
			this.#refreshing = false;
		}
	}

	#synchronize(): void {
		const input = this.input;
		const popup = this.popup;
		setListboxState(
			this.#records.map((record) => record.option),
			this.#active,
			new Set(),
			this.#invalidOptions,
		);
		if (this.#connected && popup) {
			ownSelectionId(this.#attributes, popup, "base-autocomplete-listbox");
			this.#attributes.own(popup, "role", "listbox");
			this.#attributes.own(popup, "aria-multiselectable", null);
		}
		if (this.#connected && input) {
			this.#attributes.own(input, "role", "combobox");
			this.#attributes.own(input, "aria-autocomplete", "list");
			this.#attributes.own(input, "aria-expanded", String(popup?.matches(":popover-open") ?? false));
			this.#attributes.own(input, "aria-controls", popup?.id || null);
			this.#attributes.own(
				input,
				"aria-activedescendant",
				popup?.matches(":popover-open") && this.#active ? this.#active.id : null,
			);
		}
	}

	#record(option: OptionElement): OptionRecord | undefined {
		return this.#records.find((record) => record.option === option);
	}

	#eligible(record: OptionRecord): boolean {
		return !record.disabled && !record.hidden && !record.invalid;
	}
}
