import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ToastRegionElement } from "../../src/toast-region-element.js";

const fixtures: Node[] = [];
afterEach(() => {
	vi.useRealTimers();
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const create = () => {
	const name = `aui-toast-region-${crypto.randomUUID()}`;
	customElements.define(name, class extends ToastRegionElement {});
	const element = document.createElement(name) as ToastRegionElement;
	const toast = document.createElement("article");
	const dismiss = document.createElement("button");
	toast.id = crypto.randomUUID();
	toast.slot = "toast";
	toast.hidden = true;
	toast.tabIndex = -1;
	toast.textContent = "Saved";
	dismiss.slot = "dismiss";
	dismiss.textContent = "Dismiss";
	toast.append(dismiss);
	element.append(toast);
	document.body.append(element);
	fixtures.push(element);
	return { dismiss, element, toast };
};

describe("ToastRegionElement", () => {
	test("defaults empty duration attributes and reversibly owns dismiss button type", () => {
		const { dismiss, element, toast } = create();
		expect(element.duration).toBe(5000);
		element.setAttribute("duration", "");
		toast.setAttribute("data-aui-duration", "");
		expect(element.duration).toBe(5000);
		expect(dismiss.getAttribute("type")).toBe("button");
		element.remove();
		expect(dismiss.hasAttribute("type")).toBe(false);
	});

	test("shows the same authored node, updates a stable announcer, and validates duplicate IDs", async () => {
		const { element, toast } = create();
		const heading = document.createElement("div");
		const inline = document.createElement("span");
		const message = document.createElement("p");
		const hidden = document.createElement("p");
		const ariaHidden = document.createElement("p");
		const visibilityHidden = document.createElement("div");
		const visibilityOverride = document.createElement("span");
		heading.textContent = "Review ";
		inline.textContent = "ready";
		message.innerHTML = "inter<span>national</span> notice";
		hidden.hidden = true;
		hidden.textContent = "Hidden detail";
		ariaHidden.setAttribute("aria-hidden", " TRUE ");
		ariaHidden.textContent = "ARIA hidden detail";
		visibilityHidden.style.visibility = "hidden";
		visibilityHidden.textContent = "Visibility hidden detail";
		visibilityOverride.style.visibility = "visible";
		visibilityOverride.textContent = "Visible override";
		visibilityHidden.append(visibilityOverride);
		heading.append(inline);
		toast.prepend(heading, message, hidden, ariaHidden, visibilityHidden);
		expect(element.show(toast.id, { duration: 0 })).toBe(toast);
		expect(element.show(toast.id, { duration: 0 })).toBe(toast);
		expect(element.children).toHaveLength(1);
		await Promise.resolve();
		expect(element.shadowRoot?.querySelector('[aria-live="polite"]')?.textContent).toBe(
			"Review ready international notice Visible override Saved",
		);
		const duplicate = toast.cloneNode(true) as HTMLElement;
		element.append(duplicate);
		expect(() => element.show(toast.id)).toThrowError(expect.objectContaining({ name: "InvalidStateError" }));
	});

	test("supports cancellable and native-button dismissal without synthetic form events", async () => {
		const { dismiss, element, toast } = create();
		const form = document.createElement("form");
		form.append(element);
		document.body.append(form);
		fixtures.push(form);
		const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
		form.addEventListener("submit", submit);
		element.show(toast.id, { duration: 0 });
		const cancel = (event: Event) => event.preventDefault();
		element.addEventListener("beforedismiss", cancel, { once: true });
		expect(element.dismiss(toast.id, "application")).toBe(false);
		expect(toast.hidden).toBe(false);
		await Promise.resolve();
		expect(element.shadowRoot?.querySelector('[aria-live="polite"]')?.textContent).toContain("Saved");
		const dismissed = vi.fn();
		element.addEventListener("toastdismiss", dismissed);
		await userEvent.click(dismiss);
		expect(toast.hidden).toBe(true);
		expect(dismissed.mock.calls[0][0].detail.reason).toBe("dismiss");
		expect(submit).not.toHaveBeenCalled();
	});

	test("preserves remaining duration through pointer pause and disconnection", async () => {
		vi.useFakeTimers();
		const { dismiss, element, toast } = create();
		element.show(toast.id, { duration: 100 });
		vi.advanceTimersByTime(40);
		toast.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
		vi.advanceTimersByTime(200);
		expect(toast.hidden).toBe(false);
		element.show(toast.id, { duration: 100 });
		vi.advanceTimersByTime(200);
		expect(toast.hidden).toBe(false);
		toast.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body }));
		vi.advanceTimersByTime(30);
		element.remove();
		vi.advanceTimersByTime(200);
		expect(toast.hidden).toBe(false);
		document.body.append(element);
		vi.advanceTimersByTime(80);
		expect(toast.hidden).toBe(true);

		toast.hidden = false;
		toast.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
		toast.remove();
		element.append(toast);
		element.show(toast.id, { duration: 10 });
		await Promise.resolve();
		vi.advanceTimersByTime(20);
		expect(toast.hidden).toBe(true);

		element.show(toast.id, { duration: 10 });
		dismiss.focus();
		vi.advanceTimersByTime(20);
		expect(toast.hidden).toBe(false);
		dismiss.remove();
		await Promise.resolve();
		vi.advanceTimersByTime(20);
		expect(toast.hidden).toBe(true);
	});

	test("keeps F6 opt-in and local to the enabled region", async () => {
		const first = create();
		const second = create();
		first.element.show(first.toast.id, { duration: 0 });
		second.element.show(second.toast.id, { duration: 0 });
		first.element.f6 = true;
		document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "F6" }));
		expect(document.activeElement).toBe(first.dismiss);
		first.element.f6 = false;
		second.element.f6 = true;
		document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "F6" }));
		expect(document.activeElement).toBe(second.dismiss);
	});

	test("lets an empty F6 region pass focus to a later eligible region", () => {
		const first = create();
		const second = create();
		first.element.f6 = true;
		second.element.f6 = true;
		second.element.show(second.toast.id, { duration: 0 });
		document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "F6" }));
		expect(document.activeElement).toBe(second.dismiss);
	});

	test("invalidates stale dismissal and announcement transactions", async () => {
		const { element, toast } = create();
		element.show(toast.id, { duration: 0, priority: "polite" });
		element.show(toast.id, { duration: 0, priority: "assertive" });
		await Promise.resolve();
		expect(element.shadowRoot?.querySelector('[aria-live="polite"]')?.textContent).toBe("");
		expect(element.shadowRoot?.querySelector('[aria-live="assertive"]')?.textContent).toContain("Saved");

		let nested = true;
		element.addEventListener(
			"beforedismiss",
			() => {
				nested = element.dismiss(toast.id, "nested");
				element.show(toast.id, { duration: 0 });
			},
			{ once: true },
		);
		expect(element.dismiss(toast.id, "outer")).toBe(false);
		expect(nested).toBe(false);
		expect(toast.hidden).toBe(false);

		toast.setAttribute("role", "status");
		element.show(toast.id, { duration: 0 });
		await Promise.resolve();
		expect(element.shadowRoot?.querySelector('[aria-live="polite"]')?.textContent).toBe("");
		toast.setAttribute("role", "button alert");
		element.show(toast.id, { duration: 0 });
		await Promise.resolve();
		expect(element.shadowRoot?.querySelector('[aria-live="polite"]')?.textContent).toContain("Saved");
	});

	test("skips disabled candidates and focuses omitted native controls", () => {
		const { dismiss, element, toast } = create();
		const details = document.createElement("details");
		const summary = document.createElement("summary");
		details.append(summary);
		toast.append(details);
		dismiss.disabled = true;
		dismiss.tabIndex = 0;
		element.show(toast.id, { duration: 0 });
		element.focus();
		expect(document.activeElement).toBe(summary);
	});

	test("drops timers after invalid id churn and honors native click cancellation and disabledness", () => {
		vi.useFakeTimers();
		const { dismiss, element, toast } = create();
		element.show(toast.id, { duration: 50 });
		toast.id = "";
		vi.advanceTimersByTime(100);
		expect(toast.hidden).toBe(false);

		toast.id = crypto.randomUUID();
		element.show(toast.id, { duration: 0 });
		dismiss.addEventListener("click", (event) => event.preventDefault(), { once: true });
		dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(toast.hidden).toBe(false);
		const fieldset = document.createElement("fieldset");
		fieldset.disabled = true;
		dismiss.replaceWith(fieldset);
		fieldset.append(dismiss);
		dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(toast.hidden).toBe(false);
	});

	test("does not revive an older detached-region timer after a newer cross-region show", async () => {
		vi.useFakeTimers();
		const first = create();
		const second = create();
		second.toast.remove();
		first.element.show(first.toast.id, { duration: 50 });
		first.element.remove();
		await Promise.resolve();
		second.element.append(first.toast);
		second.element.show(first.toast.id, { duration: 0 });
		first.element.append(first.toast);
		document.body.append(first.element);
		vi.advanceTimersByTime(100);
		expect(first.toast.hidden).toBe(false);
	});
});
