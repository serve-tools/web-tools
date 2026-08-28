import { AUIElement } from "./aui-element.js";

/** A committed calendar date and the user event that proposed it. */
export interface CalendarChangeDetail {
	readonly value: string;
	readonly sourceEvent: Event;
}

/** Events emitted by an inline calendar. */
export interface CalendarEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<CalendarChangeDetail>;
}

interface PlainDate {
	readonly day: number;
	readonly month: number;
	readonly year: number;
}

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const monthPattern = /^(\d{4})-(\d{2})$/u;
const weekdays = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

/** An inline Gregorian plain-date grid; it deliberately has no form identity or picker facade. */
export class CalendarElement extends AUIElement {
	static readonly observedAttributes = ["disabled", "locale", "max", "min", "month", "value", "week-starts-on"];

	#buttons: HTMLButtonElement[] = [];
	#changing = false;
	#connectionEpoch = 0;
	#focusDate: PlainDate | undefined;
	#grid = this.ownerDocument.createElement("div");
	#label = this.ownerDocument.createElement("div");
	#month = this.#monthOf(this.#today());
	#revision = 0;
	#proposing = false;
	#rows = Array.from({ length: 6 }, () => this.ownerDocument.createElement("div"));
	#value = "";
	#weekdays = this.ownerDocument.createElement("div");

	declare addEventListener: {
		<Type extends keyof CalendarEventMap>(
			type: Type,
			listener: (this: CalendarElement, event: CalendarEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};

	declare removeEventListener: {
		<Type extends keyof CalendarEventMap>(
			type: Type,
			listener: (this: CalendarElement, event: CalendarEventMap[Type]) => unknown,
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
		for (const property of [
			"value",
			"month",
			"min",
			"max",
			"locale",
			"disabled",
			"weekStartsOn",
			"focusDate",
		] as const) {
			this.#upgrade(property);
		}
		this.#grid.part.add("grid");
		this.#grid.setAttribute("role", "grid");
		this.#grid.addEventListener("click", this.#onClick);
		this.#grid.addEventListener("focusin", this.#onFocusIn);
		this.#grid.addEventListener("keydown", this.#onKeyDown);
		this.#weekdays.part.add("weekdays");
		this.#weekdays.setAttribute("role", "row");
		for (const row of this.#rows) {
			row.part.add("row");
			row.setAttribute("role", "row");
		}
		this.#readAttributes();
	}

	/** The selected ISO Gregorian plain date, or `""` when nothing is selected. */
	get value(): string {
		return this.#value;
	}

	set value(value: string) {
		const date = parseDate(String(value));
		if (value !== "" && !date) {
			throw new TypeError("Calendar value must be an ISO Gregorian date or an empty string");
		}
		this.#setAttribute("value", date ? formatDate(date) : null);
	}

	/** The displayed ISO Gregorian month. */
	get month(): string {
		return formatMonth(this.#month);
	}

	set month(value: string) {
		const month = parseMonth(String(value));
		if (!month) {
			throw new TypeError("Calendar month must be an ISO Gregorian month");
		}
		this.#setAttribute("month", formatMonth(month));
	}

	get min(): string {
		return this.getAttribute("min") ?? "";
	}

	set min(value: string) {
		this.#setDateAttribute("min", value);
	}

	get max(): string {
		return this.getAttribute("max") ?? "";
	}

	set max(value: string) {
		this.#setDateAttribute("max", value);
	}

	get locale(): string {
		return validLocale(this.getAttribute("locale") ?? this.ownerDocument.documentElement.lang) ?? "en-US";
	}

	set locale(value: string) {
		const locale = String(value);
		if (!validLocale(locale)) {
			throw new TypeError("Calendar locale must be a valid BCP 47 locale tag");
		}
		this.setAttribute("locale", locale);
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** The first weekday, Sunday 0 through Saturday 6; omission derives it from Intl.Locale when available, else Sunday. */
	get weekStartsOn(): number {
		const value = this.getAttribute("week-starts-on");
		return value === null ? localeWeekStart(this.locale) : Number(value);
	}

	set weekStartsOn(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > 6) {
			throw new TypeError("Calendar weekStartsOn must be an integer from 0 through 6");
		}
		this.setAttribute("week-starts-on", String(value));
	}

	/** The date targeted by grid keyboard navigation, or the selected date when no separate target exists. */
	get focusDate(): string {
		return formatDate(this.#focusDate ?? parseDate(this.#value) ?? this.#firstOf(this.#month));
	}

	set focusDate(value: string) {
		const date = parseDate(String(value));
		if (!date) {
			throw new TypeError("Calendar focusDate must be an ISO Gregorian date");
		}
		this.#focusDate = date;
		this.#showDate(date, true);
	}

	/** Silently changes the current selection. */
	select(value: string): void {
		this.value = value;
	}

	/** Silently changes the displayed month. */
	showMonth(value: string): void {
		this.month = value;
	}

	attributeChangedCallback(): void {
		if (!this.#changing) {
			++this.#revision;
			this.#readAttributes();
		}
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		this.#label.part.add("label");
		this.#label.id = "month";
		this.#grid.setAttribute("aria-labelledby", this.#label.id);
		this.#grid.append(this.#weekdays, ...this.#rows);
		content.append(this.#label, this.#grid, this.ownerDocument.createElement("slot"));
		this.#render();
	}

	#onClick = (event: MouseEvent): void => {
		if (event.defaultPrevented) {
			return;
		}
		const target = event.target;
		const button = target as HTMLButtonElement;
		if (!target || !this.#buttons.includes(button) || button.disabled) {
			return;
		}
		const value = button.dataset.value;
		if (value) {
			this.#focusDate = parseDate(value)!;
			this.#propose(this.#focusDate, event);
		}
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || this.disabled || !event.composedPath().includes(this.#grid)) {
			return;
		}
		const target = event.composedPath().find((node) => this.#buttons.includes(node as HTMLButtonElement)) as
			| HTMLButtonElement
			| undefined;
		const current = parseDate(target?.dataset.value ?? this.focusDate)!;
		const direction = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl" ? -1 : 1;
		let next: PlainDate | undefined;
		switch (event.key) {
			case "ArrowLeft":
				next = addDays(current, -direction);
				break;
			case "ArrowRight":
				next = addDays(current, direction);
				break;
			case "ArrowUp":
				next = addDays(current, -7);
				break;
			case "ArrowDown":
				next = addDays(current, 7);
				break;
			case "Home":
				next = addDays(current, -mod(weekday(current) - this.weekStartsOn, 7));
				break;
			case "End":
				next = addDays(current, 6 - mod(weekday(current) - this.weekStartsOn, 7));
				break;
			case "PageUp":
				next = addMonths(current, event.shiftKey ? -12 : -1);
				break;
			case "PageDown":
				next = addMonths(current, event.shiftKey ? 12 : 1);
				break;
			case "Enter":
			case " ":
				this.#propose(current, event);
				event.preventDefault();
				return;
			default:
				return;
		}
		event.preventDefault();
		if (next.year < 0 || next.year > 9999) {
			return;
		}
		this.focusDate = formatDate(next);
	};

	#onFocusIn = (event: FocusEvent): void => {
		const button = event.target as HTMLButtonElement;
		const date = this.#buttons.includes(button) ? parseDate(button.dataset.value ?? "") : undefined;
		if (date) {
			this.#focusDate = date;
		}
	};

	#propose(date: PlainDate, sourceEvent: Event): void {
		if (this.#proposing || this.disabled || this.#isDisabled(date)) {
			return;
		}
		const revision = ++this.#revision;
		const epoch = this.#connectionEpoch;
		const document = this.ownerDocument;
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<CalendarChangeDetail>("beforechange", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail: Object.freeze({ value: formatDate(date), sourceEvent }),
		});
		this.#proposing = true;
		try {
			if (
				!this.dispatchEvent(proposal) ||
				revision !== this.#revision ||
				!this.isConnected ||
				epoch !== this.#connectionEpoch ||
				document !== this.ownerDocument
			) {
				return;
			}
			this.#setAttribute("value", formatDate(date));
			const committed = this.#revision;
			const NativeEvent = this.ownerDocument.defaultView?.Event ?? Event;
			this.dispatchEvent(new NativeEvent("input", { bubbles: true, composed: true }));
			if (
				committed !== this.#revision ||
				!this.isConnected ||
				epoch !== this.#connectionEpoch ||
				document !== this.ownerDocument
			) {
				return;
			}
			this.dispatchEvent(new NativeEvent("change", { bubbles: true }));
		} finally {
			this.#proposing = false;
		}
	}

	protected override connect(connection: AUIElement.Connection): void {
		const epoch = ++this.#connectionEpoch;
		connection.addCleanup(() => {
			if (epoch === this.#connectionEpoch) {
				++this.#connectionEpoch;
			}
		});
	}

	#readAttributes(): void {
		const value = this.getAttribute("value") ?? "";
		const date = value === "" ? undefined : parseDate(value);
		if (value !== "" && !date) {
			this.removeAttribute("value");
		}
		this.#value = date ? formatDate(date) : "";
		const month = parseMonth(this.getAttribute("month") ?? "");
		this.#month = month ?? this.#monthOf(date ?? this.#today());
		const focus = this.#focusDate;
		this.#focusDate =
			date && date.year === this.#month.year && date.month === this.#month.month
				? date
				: focus && focus.year === this.#month.year && focus.month === this.#month.month
					? focus
					: this.#firstOf(this.#month);
		const week = this.getAttribute("week-starts-on");
		if (week !== null && (!/^\d$/u.test(week) || Number(week) > 6)) {
			this.removeAttribute("week-starts-on");
		}
		this.#render();
	}

	#render(): void {
		if (!this.shadowRoot) {
			return;
		}
		this.#label.textContent = monthLabel(this.locale, this.#firstOf(this.#month));
		this.#weekdays.replaceChildren(
			...weekdays.map((offset) => {
				const day = mod(this.weekStartsOn + offset, 7);
				const cell = this.ownerDocument.createElement("div");
				cell.part.add("weekday");
				cell.setAttribute("role", "columnheader");
				cell.textContent = new Intl.DateTimeFormat(this.locale, {
					calendar: "gregory",
					timeZone: "UTC",
					weekday: "short",
				}).format(toDate(addDays({ year: 2023, month: 1, day: 1 }, day)));
				return cell;
			}),
		);
		const first = this.#firstOf(this.#month);
		const start = addDays(first, -mod(weekday(first) - this.weekStartsOn, 7));
		while (this.#buttons.length < 42) {
			const button = this.ownerDocument.createElement("button");
			button.type = "button";
			button.part.add("day");
			button.setAttribute("role", "gridcell");
			this.#buttons.push(button);
			this.#rows[Math.floor((this.#buttons.length - 1) / 7)].append(button);
		}
		for (let index = 0; index < 42; ++index) {
			const date = addDays(start, index);
			const button = this.#buttons[index];
			const value = inRange(date) ? formatDate(date) : "";
			button.dataset.value = value;
			button.textContent = String(date.day);
			button.disabled = this.disabled || !inRange(date) || this.#isDisabled(date);
			button.tabIndex = value === this.focusDate ? 0 : -1;
			button.toggleAttribute("data-current", sameDate(date, this.#today()));
			button.toggleAttribute("data-selected", value === this.#value);
			button.toggleAttribute("data-outside", date.month !== this.#month.month || date.year !== this.#month.year);
			button.part.toggle("today", sameDate(date, this.#today()));
			button.part.toggle("selected", value === this.#value);
			button.part.toggle("outside", date.month !== this.#month.month || date.year !== this.#month.year);
			button.setAttribute("aria-label", dateLabel(this.locale, date));
			button.setAttribute("aria-selected", String(value === this.#value));
		}
		const focused = formatDate(this.#focusDate ?? start);
		const active =
			this.#buttons.find((button) => button.dataset.value === focused && !button.disabled) ??
			this.#buttons.find((button) => !button.disabled);
		if (active) {
			this.#focusDate = parseDate(active.dataset.value!)!;
		}
		for (const button of this.#buttons) {
			button.tabIndex = button === active ? 0 : -1;
		}
	}

	#showDate(date: PlainDate, focus: boolean): void {
		if (date.year !== this.#month.year || date.month !== this.#month.month) {
			this.#setAttribute("month", formatMonth(this.#monthOf(date)));
		}
		this.#render();
		if (focus) {
			this.#buttons.find((button) => button.dataset.value === formatDate(date))?.focus();
		}
	}

	#isDisabled(date: PlainDate): boolean {
		if (!inRange(date)) {
			return true;
		}
		const min = parseDate(this.min);
		const max = parseDate(this.max);
		return (min !== undefined && compare(date, min) < 0) || (max !== undefined && compare(date, max) > 0);
	}

	#today(): PlainDate {
		return fromDate(new Date());
	}
	#firstOf(month: PlainDate): PlainDate {
		return { year: month.year, month: month.month, day: 1 };
	}
	#monthOf(date: PlainDate): PlainDate {
		return this.#firstOf(date);
	}
	#setDateAttribute(name: "min" | "max", value: string): void {
		const date = value === "" ? undefined : parseDate(String(value));
		if (value !== "" && !date) {
			throw new TypeError(`Calendar ${name} must be an ISO Gregorian date or an empty string`);
		}
		this.#setAttribute(name, date ? formatDate(date) : null);
	}
	#setAttribute(name: string, value: string | null): void {
		++this.#revision;
		this.#changing = true;
		if (value === null) {
			this.removeAttribute(name);
		} else {
			this.setAttribute(name, value);
		}
		this.#changing = false;
		this.#readAttributes();
	}
	#upgrade(property: "value" | "month" | "min" | "max" | "locale" | "disabled" | "weekStartsOn" | "focusDate"): void {
		if (!Object.hasOwn(this, property)) {
			return;
		}
		const value = this[property];
		delete (this as Partial<Record<typeof property, unknown>>)[property];
		(this as Record<typeof property, unknown>)[property] = value;
	}
}

const mod = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;
const daysInMonth = (year: number, month: number): number =>
	month === 2
		? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
			? 29
			: 28
		: [4, 6, 9, 11].includes(month)
			? 30
			: 31;
const parseDate = (value: string): PlainDate | undefined => {
	const match = datePattern.exec(value);
	if (!match) {
		return undefined;
	}
	const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
	return Number.isSafeInteger(date.year) &&
		date.month >= 1 &&
		date.month <= 12 &&
		date.day >= 1 &&
		date.day <= daysInMonth(date.year, date.month)
		? date
		: undefined;
};
const parseMonth = (value: string): PlainDate | undefined => {
	const match = monthPattern.exec(value);
	if (!match) {
		return undefined;
	}
	const year = Number(match[1]),
		month = Number(match[2]);
	return Number.isSafeInteger(year) && month >= 1 && month <= 12 ? { year, month, day: 1 } : undefined;
};
const formatDate = ({ year, month, day }: PlainDate): string =>
	`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const formatMonth = ({ year, month }: PlainDate): string =>
	`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
const compare = (left: PlainDate, right: PlainDate): number =>
	left.year - right.year || left.month - right.month || left.day - right.day;
const sameDate = (left: PlainDate, right: PlainDate): boolean => compare(left, right) === 0;
const toDate = ({ year, month, day }: PlainDate): Date => {
	const date = new Date(0);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCFullYear(year, month - 1, day);
	return date;
};
const fromDate = (date: Date): PlainDate => ({
	year: date.getUTCFullYear(),
	month: date.getUTCMonth() + 1,
	day: date.getUTCDate(),
});
const addDays = (date: PlainDate, days: number): PlainDate =>
	fromDate(new Date(toDate(date).getTime() + days * 86_400_000));
const addMonths = (date: PlainDate, months: number): PlainDate => {
	const index = date.year * 12 + date.month - 1 + months;
	const year = Math.floor(index / 12),
		month = mod(index, 12) + 1;
	return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
};
const weekday = (date: PlainDate): number => toDate(date).getUTCDay();
const inRange = (date: PlainDate): boolean => date.year >= 0 && date.year <= 9999;
const monthLabel = (locale: string, date: PlainDate): string =>
	new Intl.DateTimeFormat(locale, {
		calendar: "gregory",
		era: "short",
		month: "long",
		timeZone: "UTC",
		year: "numeric",
	}).format(toDate(date));
const dateLabel = (locale: string, date: PlainDate): string =>
	new Intl.DateTimeFormat(locale, {
		calendar: "gregory",
		day: "numeric",
		era: "short",
		month: "long",
		timeZone: "UTC",
		weekday: "long",
		year: "numeric",
	}).format(toDate(date));
const localeWeekStart = (locale: string): number => {
	try {
		const info = (
			new Intl.Locale(locale) as unknown as { getWeekInfo?: () => { firstDay: number } }
		).getWeekInfo?.();
		return info ? info.firstDay % 7 : 0;
	} catch {
		return 0;
	}
};
const validLocale = (value: string): string | undefined => {
	try {
		return Intl.getCanonicalLocales(value)[0];
	} catch {
		return undefined;
	}
};
