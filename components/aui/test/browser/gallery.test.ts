import type {
	AccordionElement,
	AlertDialogElement,
	AutocompleteElement,
	AvatarElement,
	CalendarElement,
	CheckboxElement,
	CheckboxGroupElement,
	CollapsibleElement,
	ComboboxElement,
	ContextMenuElement,
	DrawerElement,
	FieldElement,
	FileElement,
	MenubarElement,
	MenuElement,
	MeterElement,
	NavigationMenuElement,
	NumberFieldElement,
	OptionElement,
	OTPFieldElement,
	PopoverElement,
	PreviewCardElement,
	ProgressElement,
	ScrollAreaElement,
	SelectElement,
	SliderElement,
	SwitchElement,
	ToastRegionElement,
	ToggleElement,
	ToggleGroupElement,
	ToolbarElement,
	TooltipElement,
} from "@serve-tools/aui";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { families } from "../../examples/gallery.js";
import type { GalleryDropElement } from "../../examples/integrations.js";

const fixture = document.createElement("div");

beforeAll(async () => {
	const galleryURL = new URL("../../examples/index.html", import.meta.url);
	const response = await fetch(galleryURL);
	expect(response.ok).toBe(true);
	const document = new DOMParser().parseFromString(await response.text(), "text/html");
	for (const avatar of document.querySelectorAll("app-avatar[src]")) {
		avatar.setAttribute("src", new URL(avatar.getAttribute("src")!, galleryURL).href);
	}
	const stylesheet = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')!;
	stylesheet.href = new URL(stylesheet.getAttribute("href")!, galleryURL).href;
	const styled = new Promise<void>((resolve, reject) => {
		stylesheet.addEventListener("load", () => resolve(), { once: true });
		stylesheet.addEventListener("error", () => reject(new Error("Gallery stylesheet failed to load")), {
			once: true,
		});
	});
	fixture.append(stylesheet);
	fixture.append(...document.body.children);
	globalThis.document.body.append(fixture);
	await styled;
	await import("../../examples/main.js");
});

afterEach(() => {
	for (const popup of fixture.querySelectorAll<HTMLElement>("[popover]:popover-open")) {
		popup.hidePopover();
	}
	for (const dialog of fixture.querySelectorAll<HTMLDialogElement>("dialog[open]")) {
		dialog.close();
	}
	const search = fixture.querySelector<HTMLInputElement>("#component-search")!;
	const category = fixture.querySelector<HTMLSelectElement>("#component-category")!;
	search.value = "";
	category.value = "";
	search.dispatchEvent(new Event("input"));
});

afterAll(() => fixture.remove());

test("accounts for every family with either a working example or an explicit pending entry", () => {
	const links = fixture.querySelectorAll<HTMLAnchorElement>("#component-navigation a");
	expect(links).toHaveLength(families.length);
	for (const [id, name] of families) {
		const content = fixture.querySelector("#component-" + id);
		expect(content, name).not.toBeNull();
		const link = Array.from(links).find((item) => item.getAttribute("href") === "#component-" + id)!;
		expect(link.textContent).toBe(name);
		if (content!.matches("[data-component]")) {
			expect(content!.querySelector(".preview")).not.toBeNull();
			expect(content!.querySelector("pre code")!.textContent).not.toBe("");
			expect(link.classList.contains("pending-link")).toBe(false);
		} else {
			expect(content!.textContent).toContain("Not implemented");
			expect(link.classList.contains("pending-link")).toBe(true);
		}
	}
	expect(new Set(families.map(([id]) => id)).size).toBe(families.length);
	expect(fixture.querySelectorAll("[data-component]")).toHaveLength(44);
	expect(fixture.querySelectorAll("#component-navigation .pending-link")).toHaveLength(0);
	expect(fixture.querySelector("#component-count")!.textContent).toBe("38 of 38 Base UI families have examples");
});

test("the gallery navigation and calendar fit a narrow viewport", async () => {
	const width = innerWidth;
	const height = innerHeight;
	try {
		await page.viewport(390, 844);
		const search = fixture.querySelector<HTMLInputElement>("#component-search")!;
		await userEvent.fill(search, "Calendar");
		expect(getComputedStyle(fixture.querySelector(".sidebar")!).position).toBe("static");
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
		const calendar = fixture.querySelector<CalendarElement>("#booking-calendar")!;
		expect(calendar.getBoundingClientRect().width).toBeLessThanOrEqual(innerWidth);
		const engine = navigator.userAgent.includes("Firefox")
			? "firefox"
			: navigator.userAgent.includes("Chrome")
				? "chromium"
				: "webkit";
		await page.screenshot({ path: `__screenshots__/gallery.test.ts/mobile-layout-${engine}.png` });
		await page.screenshot({
			element: calendar.closest(".preview")!,
			path: `__screenshots__/gallery.test.ts/mobile-calendar-${engine}.png`,
		});
	} finally {
		await page.viewport(width, height);
	}
});

test("search and category filters preserve the example nodes and report empty results", () => {
	const search = fixture.querySelector<HTMLInputElement>("#component-search")!;
	const category = fixture.querySelector<HTMLSelectElement>("#component-category")!;
	const checkbox = fixture.querySelector<HTMLElement>("#component-checkbox")!;
	const empty = fixture.querySelector<HTMLElement>("#empty-results")!;
	search.value = "checkbox";
	search.dispatchEvent(new Event("input"));
	expect(checkbox.hidden).toBe(false);
	expect(fixture.querySelector<HTMLElement>("#component-tabs")!.hidden).toBe(true);
	expect(empty.hidden).toBe(true);

	category.value = "Layers";
	category.dispatchEvent(new Event("change"));
	expect(checkbox.hidden).toBe(true);
	expect(empty.hidden).toBe(false);
	expect(fixture.querySelector<HTMLElement>("#pending")!.hidden).toBe(true);
	expect(fixture.querySelector("#component-checkbox")).toBe(checkbox);
});

test("the Checkbox example submits native form values and honors its cancellation switch", async () => {
	const checkbox = fixture.querySelector<CheckboxElement>("#preferences app-checkbox")!;
	const form = fixture.querySelector<HTMLFormElement>("#preferences")!;
	const lock = fixture.querySelector<HTMLInputElement>("#lock")!;
	expect(new FormData(form).get("updates")).toBe("no");
	await userEvent.click(checkbox);
	expect(checkbox.checked).toBe(true);
	form.requestSubmit();
	expect(fixture.querySelector("#submission")!.textContent).toBe("Submitted updates: yes");
	lock.checked = true;
	await userEvent.click(checkbox);
	expect(checkbox.checked).toBe(true);
	expect(fixture.querySelector("#interaction")!.textContent).toContain("canceled");
	lock.checked = false;
	form.reset();
	expect(checkbox.checked).toBe(false);
});

test("native examples keep real editing, activation, mixed-form submission, and the fieldset legend exception", async () => {
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#native-action")!);
	expect(fixture.querySelector("#native-action-result")!.textContent).toBe("Action ran 1 time.");
	const input = fixture.querySelector<HTMLInputElement>("#native-input")!;
	await userEvent.fill(input, "Native text editor");
	expect(fixture.querySelector("#native-input-result")!.textContent).toBe("Native text editor");
	const fieldset = fixture.querySelector<HTMLFieldSetElement>("#native-fieldset")!;
	const enable = fixture.querySelector<HTMLInputElement>("#fieldset-enabled")!;
	const checkbox = fieldset.querySelector<CheckboxElement>("app-checkbox")!;
	expect(enable.matches(":disabled")).toBe(false);
	expect(checkbox.matches(":disabled")).toBe(true);
	await userEvent.click(enable);
	expect(fieldset.disabled).toBe(false);
	expect(checkbox.matches(":disabled")).toBe(false);
	const form = fixture.querySelector<HTMLFormElement>("#native-form")!;
	await userEvent.click(form.querySelector<HTMLButtonElement>("button[type=submit]")!);
	expect(fixture.querySelector("#native-form-result")!.textContent).toBe(
		"email: reader@example.test; consent: yes; action: save",
	);
});

test("native Radio Group submits one value and restores its declared selection", async () => {
	const form = fixture.querySelector<HTMLFormElement>("#radio-form")!;
	const phone = form.querySelector<HTMLInputElement>("input[value=phone]")!;
	await userEvent.click(phone.closest("label")!);
	expect(new FormData(form).getAll("contact")).toEqual(["phone"]);
	form.requestSubmit();
	expect(fixture.querySelector("#radio-result")!.textContent).toBe("Preferred contact: phone");
	form.reset();
	expect(new FormData(form).getAll("contact")).toEqual(["email"]);
	expect(fixture.querySelector("#radio-result")!.textContent).toBe("No contact preference submitted.");
});

test("Switch and Checkbox Group examples preserve their individual form values", async () => {
	const switchForm = fixture.querySelector<HTMLFormElement>("#switch-form")!;
	const control = switchForm.querySelector<SwitchElement>("app-switch")!;
	expect(new FormData(switchForm).get("automatic")).toBe("off");
	await userEvent.click(control);
	switchForm.requestSubmit();
	expect(fixture.querySelector("#switch-result")!.textContent).toBe("Automatic updates: on");
	switchForm.reset();
	expect(control.checked).toBe(false);
	const group = fixture.querySelector<CheckboxGroupElement>("#feature-group")!;
	const form = fixture.querySelector<HTMLFormElement>("#features-form")!;
	const parent = group.querySelector<CheckboxElement>("[parent]")!;
	expect(parent.indeterminate).toBe(true);
	await userEvent.click(parent);
	expect(group.values).toEqual(["activity", "digest", "security"]);
	expect(parent.indeterminate).toBe(true);
	expect(new FormData(form).getAll("feature")).toEqual(["activity", "digest"]);
	expect(new FormData(form).has("all-features")).toBe(false);
	await userEvent.click(parent);
	expect(group.values).toEqual(["security"]);
	form.reset();
	expect(group.values).toEqual(["activity", "security"]);
});

test("Field connects its native label and coordinates explicit server validity without a duplicate value", async () => {
	const field = fixture.querySelector<FieldElement>("#email-field")!;
	const input = field.control as HTMLInputElement;
	const form = fixture.querySelector<HTMLFormElement>("#field-form")!;
	expect(field.label!.control).toBe(input);
	expect(new FormData(form).getAll("email")).toEqual(["reader@example.test"]);
	await userEvent.fill(input, "edited@example.test");
	expect(field.dirty).toBe(true);
	await userEvent.click(fixture.querySelector("#field-server-error")!);
	expect(field.invalid).toBe(true);
	expect(input.validationMessage).toBe("This address is already in use.");
	await userEvent.click(fixture.querySelector("#field-clear-error")!);
	expect(field.valid).toBe(true);
	form.requestSubmit();
	expect(fixture.querySelector("#field-result")!.textContent).toBe("Email: edited@example.test");
	form.reset();
	await expect.poll(() => field.dirty).toBe(false);
});

test("Number Field and OTP examples compose through Field while retaining their native editors", async () => {
	const number = fixture.querySelector<NumberFieldElement>("#quantity-field")!;
	const numberForm = fixture.querySelector<HTMLFormElement>("#number-form")!;
	const numberField = number.parentElement as FieldElement;
	expect(numberField.control).toBe(number.input);
	expect(numberField.label!.control).toBe(number.input);
	await userEvent.click(number.incrementButton!);
	expect(number.value).toBe("3");
	expect(fixture.querySelector("#quantity-value")!.textContent).toBe("Quantity: 3");
	numberForm.requestSubmit();
	expect(numberForm.querySelector("[data-submission]")!.textContent).toBe("quantity: 3");
	numberForm.reset();
	await expect.poll(() => number.value).toBe("2");
	const otp = fixture.querySelector<OTPFieldElement>("#code-field")!;
	const otpForm = fixture.querySelector<HTMLFormElement>("#otp-form")!;
	expect((otp.parentElement as FieldElement).label!.control).toBe(otp.input);
	await userEvent.fill(otp.input!, "123456");
	expect(otp.segments.map((segment) => segment.getAttribute("data-value")).join("")).toBe("123456");
	expect(otp.input!.validity.valid).toBe(true);
	otpForm.requestSubmit();
	expect(otpForm.querySelector("[data-submission]")!.textContent).toBe("code: 123456");
	otpForm.reset();
	await expect.poll(() => otp.value).toBe("");
});

test("Slider examples edit native ranges, maintain ordering, and submit distinct named values", async () => {
	const slider = fixture.querySelector<SliderElement>("#price-slider")!;
	const volume = fixture.querySelector<SliderElement>("#volume-slider")!;
	const form = fixture.querySelector<HTMLFormElement>("#slider-form")!;
	expect(slider.values).toEqual([25, 75]);
	volume.inputs[0]!.focus();
	await userEvent.keyboard("{ArrowRight}");
	expect(volume.value).toBe(51);
	slider.inputs[0]!.focus();
	await userEvent.keyboard("{End}");
	expect(slider.values).toEqual([75, 75]);
	form.requestSubmit();
	expect(form.querySelector("[data-submission]")!.textContent).toBe("volume: 51; minimum: 75; maximum: 75");
	form.reset();
	await expect.poll(() => slider.values).toEqual([25, 75]);
});

test("Autocomplete submits accepted visible text and preserves free text", async () => {
	const autocomplete = fixture.querySelector<AutocompleteElement>("#city-autocomplete")!;
	const form = fixture.querySelector<HTMLFormElement>("#autocomplete-form")!;
	await userEvent.fill(autocomplete.input!, "Par");
	await userEvent.keyboard("{ArrowDown}{Enter}");
	expect(autocomplete.input!.value).toBe("Paris");
	form.requestSubmit();
	expect(form.querySelector("[data-submission]")!.textContent).toBe("city: Paris");
	await userEvent.fill(autocomplete.input!, "My own destination");
	expect(new FormData(form).get("city")).toBe("My own destination");
	form.reset();
});

test("Combobox and Select examples submit only their canonical selected identities", async () => {
	const combo = fixture.querySelector<ComboboxElement>("#language-combobox")!;
	const comboForm = fixture.querySelector<HTMLFormElement>("#combobox-form")!;
	const query = combo.querySelector<HTMLInputElement>("input")!;
	query.focus();
	await userEvent.keyboard("{ArrowDown}{Enter}");
	expect(combo.values).toEqual(["ts"]);
	expect(new FormData(comboForm).getAll("language")).toEqual(["ts"]);
	expect(query.hasAttribute("name")).toBe(false);
	comboForm.requestSubmit();
	expect(comboForm.querySelector("[data-submission]")!.textContent).toBe("language: ts");
	comboForm.reset();
	const single = fixture.querySelector<SelectElement>("#plan-select")!;
	const multiple = fixture.querySelector<SelectElement>("#region-select")!;
	const form = fixture.querySelector<HTMLFormElement>("#select-form")!;
	await userEvent.click(single.querySelector("button")!);
	await userEvent.click(single.querySelector<OptionElement>('app-option[value="enterprise"]')!);
	expect(single.value).toBe("enterprise");
	expect(single.querySelector("button")!.textContent).toBe("Enterprise");
	await userEvent.click(multiple.querySelector("button")!);
	await userEvent.click(multiple.querySelector<OptionElement>('app-option[value=""]')!);
	expect(multiple.values).toEqual(["na", ""]);
	expect(new FormData(form).getAll("region")).toEqual(["na", ""]);
	form.reset();
	await expect.poll(() => single.querySelector("button")!.textContent).toBe("Professional");
	expect(multiple.values).toEqual(["na"]);
});

test("Menu and Context Menu examples perform native actions and keep checkable state", async () => {
	const menu = fixture.querySelector<MenuElement>("#workspace-menu")!;
	await userEvent.click(menu.trigger!);
	expect(menu.open).toBe(true);
	await expect
		.element(page.getByRole("menuitemradio", { name: "Light", exact: true }))
		.toHaveAttribute("aria-checked", "true");
	await userEvent.click(menu.querySelector('[role="menuitemcheckbox"]')!);
	expect(fixture.querySelector("#menu-result")!.textContent).toBe("Grid: on; theme: Light");
	await expect
		.element(page.getByRole("menuitemcheckbox", { name: "Show grid", exact: true }))
		.toHaveAttribute("aria-checked", "true");
	expect(menu.open).toBe(true);
	await userEvent.click(menu.querySelector('[data-command="New workspace"]')!);
	expect(menu.open).toBe(false);
	expect(fixture.querySelector("#menu-result")!.textContent).toBe("Action: New workspace");
	const context = fixture.querySelector<ContextMenuElement>("#document-context-menu")!;
	context.trigger!.focus();
	await userEvent.keyboard("{Shift>}{F10}{/Shift}");
	expect(context.open).toBe(true);
	await userEvent.click(context.querySelector('[data-command="Rename document"]')!);
	expect(context.open).toBe(false);
	expect(context.closest(".preview")!.querySelector("output")!.textContent).toBe("Action: Rename document");
});

test("Menubar, Navigation Menu, and Toolbar examples preserve their distinct focus models", async () => {
	const menubar = fixture.querySelector<MenubarElement>("#editor-menubar")!;
	menubar.items[0]!.focus();
	await userEvent.keyboard("{ArrowRight}");
	expect(document.activeElement).toBe(menubar.items[1]);
	await userEvent.keyboard("{ArrowDown}");
	const edit = menubar.querySelectorAll<MenuElement>("app-menu")[1]!;
	expect(edit.open).toBe(true);
	await userEvent.click(edit.querySelector('[data-command="Undo"]')!);
	expect(menubar.closest(".preview")!.querySelector("output")!.textContent).toBe("Action: Undo");
	const navigation = fixture.querySelector<NavigationMenuElement>("#site-navigation")!;
	const trigger = navigation.disclosureTriggers[0]!;
	await userEvent.click(trigger);
	expect(navigation.openTrigger).toBe(trigger);
	expect(navigation.items.every((item) => !item.hasAttribute("tabindex"))).toBe(true);
	navigation.hide();
	const toolbar = fixture.querySelector<ToolbarElement>("#editor-toolbar")!;
	toolbar.items[0]!.focus();
	await userEvent.keyboard("{ArrowRight}");
	expect(document.activeElement).toBe(toolbar.items[1]);
	const toggle = toolbar.querySelector<ToggleElement>("app-toggle")!;
	expect(toggle.pressed).toBe(false);
	await userEvent.keyboard(" ");
	expect(toggle.pressed).toBe(true);
});

test("Drawer keeps native dialog editing and close results through presentation snaps", async () => {
	const drawer = fixture.querySelector<DrawerElement>("#settings-drawer")!;
	await userEvent.click(fixture.querySelector("#open-drawer")!);
	expect(drawer.open).toBe(true);
	expect(drawer.dialog!.matches(":modal")).toBe(true);
	const input = drawer.querySelector<HTMLInputElement>("input")!;
	await userEvent.fill(input, "Retained drawer title");
	await userEvent.click(fixture.querySelector("#half-drawer")!);
	expect(drawer.snapPoint).toBe(0.5);
	await userEvent.click(fixture.querySelector("#expand-drawer")!);
	expect(drawer.snapPoint).toBe(1);
	await userEvent.click(drawer.querySelector('button[value="saved"]')!);
	expect(drawer.open).toBe(false);
	await expect.poll(() => fixture.querySelector("#drawer-result")!.textContent).toBe("Drawer result: saved");
	await userEvent.click(fixture.querySelector("#open-drawer")!);
	expect(drawer.querySelector("input")).toBe(input);
	expect(input.value).toBe("Retained drawer title");
	drawer.close();
});

test("Toast examples reuse authored nodes and distinguish timed from persistent notifications", async () => {
	const region = fixture.querySelector<ToastRegionElement>("#notifications")!;
	const saved = region.querySelector<HTMLElement>("#saved-toast")!;
	const review = region.querySelector<HTMLElement>("#review-toast")!;
	expect(region.duration).toBe(5000);
	await userEvent.click(fixture.querySelector("#show-toast")!);
	expect(saved.hidden).toBe(false);
	region.dismiss("saved-toast", "test");
	expect(saved.hidden).toBe(true);
	await userEvent.click(fixture.querySelector("#show-persistent-toast")!);
	expect(review.hidden).toBe(false);
	region.focus();
	expect(document.activeElement).toBe(review.querySelector("button"));
	await userEvent.click(review.querySelector("button")!);
	expect(review.hidden).toBe(true);
	expect(region.querySelector("#review-toast")).toBe(review);
});

test("Scroll Area exposes a usable native viewport and live scroll metrics", async () => {
	const scroll = fixture.querySelector<ScrollAreaElement>("#document-scroll")!;
	const viewport = scroll.viewport!;
	expect(scroll.metrics.maxBlock).toBeGreaterThan(0);
	viewport.focus();
	const settled = new Promise<void>((resolve) =>
		viewport.addEventListener("scrollend", () => resolve(), { once: true }),
	);
	await userEvent.keyboard("{PageDown}");
	await expect.poll(() => scroll.metrics.block).toBeGreaterThan(0);
	await settled;
	expect(scroll.querySelector('[slot="scrollbar-y"]')!.getAttribute("aria-hidden")).toBe("true");
	await userEvent.click(fixture.querySelector("#scroll-top")!);
	await expect.poll(() => scroll.metrics.block).toBe(0);
});

test("Calendar exposes a real date grid with styled parts and silent view controls", async () => {
	const calendar = fixture.querySelector<CalendarElement>("#booking-calendar")!;
	const grid = calendar.shadowRoot!.querySelector('[role="grid"]')!;
	const label = calendar.shadowRoot!.querySelector('[part="label"]')!;
	expect(label.textContent).toContain("August 2026");
	expect(grid.getAttribute("aria-labelledby")).toBe(label.id);
	expect(grid.querySelectorAll('[role="row"]')).toHaveLength(7);
	expect(grid.querySelectorAll('[part~="day"]')).toHaveLength(42);
	await userEvent.click(calendar.shadowRoot!.querySelector('[data-value="2026-08-29"]')!);
	expect(calendar.value).toBe("2026-08-29");
	expect(fixture.querySelector("#calendar-result")!.textContent).toBe("Selected date: 2026-08-29");
	await userEvent.click(fixture.querySelector("#calendar-clear")!);
	expect(calendar.value).toBe("");
});

test("File example keeps its native input and inspects local form data without uploading", async () => {
	const file = fixture.querySelector<FileElement>("#attachments")!;
	const form = fixture.querySelector<HTMLFormElement>("#file-form")!;
	const field = file.parentElement as FieldElement;
	expect(field.label!.control).toBe(file.input);
	await userEvent.click(fixture.querySelector("#sample-file")!);
	expect(file.files.map((entry) => entry.name)).toEqual(["example.txt"]);
	form.requestSubmit();
	expect(fixture.querySelector("#file-result")!.textContent).toBe("Local form files: example.txt");
	form.reset();
	await expect.poll(() => file.files.length).toBe(0);
});

test("Popover, Tooltip, Preview Card, and Alert Dialog examples use their native layers", async () => {
	const popover = fixture.querySelector<PopoverElement>("app-popover")!;
	const trigger = fixture.querySelector<HTMLButtonElement>('button[popovertarget="settings-popup"]')!;
	await userEvent.click(trigger);
	expect(popover.open).toBe(true);
	const draft = popover.popup!.querySelector<HTMLInputElement>("input")!;
	await userEvent.fill(draft, "Retained popup draft");
	await userEvent.click(popover.popup!.querySelector<HTMLButtonElement>("button")!);
	expect(popover.open).toBe(false);
	await userEvent.click(trigger);
	expect(popover.popup!.querySelector("input")).toBe(draft);
	expect(draft.value).toBe("Retained popup draft");
	popover.hide();
	const tooltip = fixture.querySelector<TooltipElement>("app-tooltip")!;
	tooltip.trigger!.focus();
	await expect.poll(() => tooltip.open).toBe(true);
	expect(tooltip.trigger!.getAttribute("aria-describedby")!.split(/\s+/)).toContain(tooltip.popup!.id);
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => tooltip.open).toBe(false);
	const preview = fixture.querySelector<PreviewCardElement>("app-preview-card")!;
	preview.trigger!.focus();
	await expect.poll(() => preview.open).toBe(true);
	expect(preview.trigger!.getAttribute("href")).toBe("#component-base");
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => preview.open).toBe(false);
	const alert = fixture.querySelector<AlertDialogElement>("app-alert-dialog")!;
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#open-alert")!);
	expect(alert.open).toBe(true);
	expect(alert.dialog!.matches(":modal")).toBe(true);
	await userEvent.click(alert.dialog!.querySelector<HTMLButtonElement>("button[value=cancel]")!);
	await expect.poll(() => fixture.querySelector("#alert-result")!.textContent).toBe("Alert result: cancel");
	expect(alert.open).toBe(false);
});

test("standalone and grouped Toggle examples report committed state", async () => {
	const favorite = fixture.querySelector<ToggleElement>("#favorite-toggle")!;
	await userEvent.click(favorite.button!);
	expect(favorite.pressed).toBe(true);
	expect(fixture.querySelector("#favorite-result")!.textContent).toBe("Added to favorites.");
	const group = fixture.querySelector<ToggleGroupElement>("#formatting")!;
	await userEvent.click(group.querySelector<HTMLButtonElement>("button")!);
	expect(group.values).toEqual(["bold"]);
	expect(fixture.querySelector("#formatting-result")!.textContent).toBe("Selected formatting: bold");
});

test("the lifecycle example reconnects the same counter with retained state", async () => {
	const counter = fixture.querySelector<HTMLElement>("#retained-counter")!;
	const count = counter.querySelector<HTMLButtonElement>("button")!;
	const connection = fixture.querySelector<HTMLButtonElement>("#counter-connection")!;
	await userEvent.click(count);
	await expect.poll(() => count.textContent).toBe("Count: 1");
	await userEvent.click(connection);
	expect(counter.isConnected).toBe(false);
	await userEvent.click(connection);
	expect(counter.isConnected).toBe(true);
	expect(counter.querySelector("button")).toBe(count);
	expect(count.textContent).toBe("Count: 1");
});

test("the disclosure examples preserve panel edits while coordinating open state", async () => {
	const accordion = fixture.querySelector<AccordionElement>("app-accordion")!;
	const [first, second] = accordion.disclosures;
	expect(accordion.values).toEqual(["platform"]);
	await userEvent.click(second!.button!);
	expect(accordion.values).toEqual(["state"]);
	expect(first!.panel!.hidden).toBe(true);
	const draft = second!.panel!.querySelector<HTMLInputElement>("input")!;
	await userEvent.fill(draft, "Retained gallery draft");
	await userEvent.click(first!.button!);
	await userEvent.click(second!.button!);
	expect(second!.panel!.querySelector("input")).toBe(draft);
	expect(draft.value).toBe("Retained gallery draft");
	const standalone = fixture.querySelector<CollapsibleElement>("#component-collapsible app-collapsible")!;
	await userEvent.click(standalone.button!);
	expect(standalone.open).toBe(true);
});

test("display examples update native numeric state and preserve avatar fallback", async () => {
	const meter = fixture.querySelector<MeterElement>("#storage-meter")!;
	const capacity = fixture.querySelector<HTMLInputElement>("#storage-capacity")!;
	capacity.value = "80";
	capacity.dispatchEvent(new Event("input", { bubbles: true }));
	expect(meter.value).toBe(80);
	expect(meter.getAttribute("aria-valuetext")).toBe("80 of 100 GB");
	const progress = fixture.querySelector<ProgressElement>("#upload-progress")!;
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#advance-progress")!);
	expect(progress.value).toBe(60);
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#indeterminate-progress")!);
	expect(progress.status).toBe("indeterminate");
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#advance-progress")!);
	expect(progress.value).toBe(0);
	expect(progress.status).toBe("progressing");
	const avatar = fixture.querySelector<AvatarElement>("#example-avatar")!;
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#avatar-source")!);
	expect(avatar.src).toBe("");
	expect(avatar.status).toBe("idle");
	expect(avatar.textContent).toBe("AL");
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#avatar-source")!);
	await expect.poll(() => avatar.status).toBe("loaded");
});

test("context integration moves the same consumer between providers without resetting local state", async () => {
	const consumer = fixture.querySelector<HTMLElement>("app-context-value")!;
	const counter = consumer.querySelector<HTMLButtonElement>("app-counter button")!;
	const output = consumer.querySelector("output")!;
	await expect.poll(() => output.textContent).toBe("Current workspace: Studio");
	await userEvent.click(counter);
	await expect.poll(() => counter.textContent).toBe("Count: 1");
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#move-context")!);
	expect(consumer.parentElement!.id).toBe("review-workspace");
	await expect.poll(() => output.textContent).toBe("Current workspace: Review");
	expect(consumer.querySelector("app-counter button")).toBe(counter);
	expect(counter.textContent).toBe("Count: 1");
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#rename-context")!);
	await expect.poll(() => output.textContent).toBe("Current workspace: Renamed workspace");
});

test("drop integration accepts text, stops observing on removal, and offers a keyboard action", async () => {
	const target = fixture.querySelector<GalleryDropElement>("app-drop-zone")!;
	const parent = target.parentElement!;
	const transfer = new DataTransfer();
	transfer.setData("text/plain", "Synthetic drop fixture");
	target.dispatchEvent(new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true }));
	expect(target.matches(":state(drop-active)")).toBe(true);
	const over = new DragEvent("dragover", { dataTransfer: transfer, bubbles: true, cancelable: true });
	target.dispatchEvent(over);
	expect(over.defaultPrevented).toBe(true);
	target.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
	await expect.poll(() => target.querySelector("output")!.textContent).toBe("Received: Synthetic drop fixture");
	expect(target.matches(":state(drop-active)")).toBe(false);
	target.remove();
	target.dispatchEvent(new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true }));
	expect(target.matches(":state(drop-active)")).toBe(false);
	parent.append(target);
	await userEvent.click(fixture.querySelector<HTMLButtonElement>("#send-token")!);
	await expect.poll(() => target.querySelector("output")!.textContent).toBe("Received: Review token");
});

test("the native Time example keeps bounds, step validation, and string form serialization", () => {
	const form = fixture.querySelector<HTMLFormElement>("#time-form")!;
	const input = form.querySelector("input")!;
	expect(new FormData(form).get("time")).toBe("10:30");
	input.value = "10:31";
	expect(input.validity.stepMismatch).toBe(true);
	input.value = "08:00";
	expect(input.validity.rangeUnderflow).toBe(true);
	form.reset();
	form.requestSubmit();
	expect(fixture.querySelector("#time-result")!.textContent).toBe("Preferred time: 10:30");
});
