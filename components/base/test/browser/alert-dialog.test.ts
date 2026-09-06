import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { AlertDialogElement } from "../../src/AlertDialogElement.js";

const fixtures: Element[] = [];
const closeEvent = (dialog: HTMLDialogElement) =>
	new Promise<void>((resolve) => dialog.addEventListener("close", () => resolve(), { once: true }));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = () => {
	const name = `base-alert-dialog-${crypto.randomUUID()}`;
	customElements.define(name, class extends AlertDialogElement {});
	const element = document.createElement(name) as AlertDialogElement;
	const dialog = document.createElement("dialog");
	dialog.setAttribute("aria-labelledby", "alert-title");
	dialog.setAttribute("aria-describedby", "alert-description");
	dialog.innerHTML = '<h2 id="alert-title">Delete?</h2><p id="alert-description">This cannot be undone.</p>';
	element.append(dialog);
	document.body.append(element);
	fixtures.push(element);
	return { dialog, element };
};

describe("AlertDialogElement", () => {
	test("exposes modal-only operations and owns the direct dialog alert role", () => {
		const { dialog, element } = create();
		expect(element.dialog).toBe(dialog);
		expect("show" in element).toBe(false);
		expect(dialog.role).toBe("alertdialog");
		expect(element.open).toBe(false);

		element.showModal();
		expect(element.open).toBe(true);
		element.close("confirmed");
		expect(element.returnValue).toBe("confirmed");
	});

	test("requires authored label and description attributes without claiming computed-name validation", () => {
		const { dialog, element } = create();
		dialog.removeAttribute("aria-labelledby");
		expect(() => element.showModal()).toThrowError(expect.objectContaining({ name: "InvalidStateError" }));
		dialog.setAttribute("aria-label", "Delete item");
		dialog.removeAttribute("aria-describedby");
		expect(() => element.showModal()).toThrowError(expect.objectContaining({ name: "InvalidStateError" }));
		dialog.setAttribute("aria-description", "This cannot be undone");
		element.showModal();
		element.close();
	});

	test("restores authored roles when the direct dialog is replaced", () => {
		const { dialog, element } = create();
		dialog.role = "dialog";
		return Promise.resolve().then(() => {
			expect(dialog.role).toBe("alertdialog");
			const replacement = document.createElement("dialog");
			dialog.replaceWith(replacement);
			expect(element.dialog).toBe(replacement);
			expect(dialog.role).toBe("dialog");
			expect(replacement.role).toBe("alertdialog");
		});
	});

	test("retains native modal focus and method=dialog return values", async () => {
		const { dialog, element } = create();
		const opener = document.createElement("button");
		const form = document.createElement("form");
		const submit = document.createElement("button");
		form.method = "dialog";
		submit.value = "delete";
		submit.autofocus = true;
		form.append(submit);
		dialog.append(form);
		element.before(opener);
		fixtures.push(opener);
		opener.focus();
		const closed = closeEvent(dialog);

		element.showModal();
		expect(document.activeElement).toBe(submit);
		await userEvent.click(submit);
		expect(element.open).toBe(false);
		expect(element.returnValue).toBe("delete");
		await closed;
		expect(document.activeElement).toBe(opener);
	});

	test("forwards native Escape cancellation synchronously", async () => {
		const { dialog, element } = create();
		const nativeCancel = vi.fn();
		const hostCancel = vi.fn((event: Event) => event.preventDefault());
		dialog.addEventListener("cancel", nativeCancel);
		element.addEventListener("cancel", hostCancel);
		element.showModal();

		await userEvent.keyboard("{Escape}");
		expect(hostCancel).toHaveBeenCalledOnce();
		expect(nativeCancel.mock.calls[0]?.[0].defaultPrevented).toBe(true);
		expect(dialog.open).toBe(true);
		element.close();
	});

	test("does not interpret outside pointer events as dismissal", () => {
		const { dialog, element } = create();
		element.showModal();
		dialog.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		dialog.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
		dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(element.open).toBe(true);
		element.close();
	});

	test("uses the adopted realm and reconnects without duplicate event forwarding", () => {
		const { dialog, element } = create();
		const frame = document.createElement("iframe");
		document.body.append(frame);
		fixtures.push(frame);
		const frameDocument = frame.contentDocument;
		const FrameEvent = frameDocument?.defaultView?.Event;
		if (!frameDocument || !FrameEvent) {
			throw new Error("Same-origin frame is unavailable");
		}

		frameDocument.body.append(frameDocument.adoptNode(element));
		let forwarded: Event | undefined;
		let closes = 0;
		element.addEventListener("close", (event) => {
			forwarded = event;
			++closes;
		});
		dialog.dispatchEvent(new FrameEvent("close"));
		expect(forwarded).toBeInstanceOf(FrameEvent);
		element.remove();
		frameDocument.body.append(element);
		dialog.dispatchEvent(new FrameEvent("close"));
		expect(closes).toBe(2);
	});
});
