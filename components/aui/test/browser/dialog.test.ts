import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { DialogElement } from "../../src/dialog-element.js";

const fixtures: Node[] = [];
const closeEvent = (dialog: HTMLDialogElement) =>
	new Promise<void>((resolve) => dialog.addEventListener("close", () => resolve(), { once: true }));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

const defineDialog = (): { element: DialogElement; name: string } => {
	const name = `aui-dialog-${crypto.randomUUID()}`;
	customElements.define(name, class extends DialogElement {});
	return { element: document.createElement(name) as DialogElement, name };
};

const create = (): { dialog: HTMLDialogElement; element: DialogElement } => {
	const { element } = defineDialog();
	const dialog = document.createElement("dialog");
	element.append(dialog);
	append(element);
	return { dialog, element };
};

describe("DialogElement", () => {
	test("keeps the author dialog identity, accessible relationships, and native state", () => {
		const { dialog, element } = create();
		const title = document.createElement("h2");
		title.id = crypto.randomUUID();
		dialog.setAttribute("aria-labelledby", title.id);
		dialog.append(title);
		dialog.returnValue = "preserved";

		expect(element.dialog).toBe(dialog);
		expect(element.firstElementChild).toBe(dialog);
		expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);

		element.show();
		expect(element.open).toBe(true);
		element.remove();
		document.body.append(element);
		expect(element.dialog).toBe(dialog);
		expect(element.open).toBe(true);
		expect(element.returnValue).toBe("preserved");
		element.close();
	});

	test("defines explicit missing and replacement-child behavior", () => {
		const { element } = defineDialog();
		append(element);

		expect(element.dialog).toBeNull();
		expect(element.open).toBe(false);
		expect(element.returnValue).toBe("");
		for (const operation of [() => element.show(), () => element.showModal(), () => element.close()]) {
			expect(operation).toThrowError(expect.objectContaining({ name: "InvalidStateError" }));
		}

		const first = document.createElement("dialog");
		const replacement = document.createElement("dialog");
		first.returnValue = "first";
		replacement.returnValue = "replacement";
		element.append(first);
		expect(element.dialog).toBe(first);
		first.replaceWith(replacement);
		expect(element.dialog).toBe(replacement);
		expect(element.returnValue).toBe("replacement");
		element.show();
		expect(replacement.open).toBe(true);
		expect(first.open).toBe(false);
		element.close();
	});

	test("supports defined-before-parse children and application-controlled late upgrade", () => {
		const definedName = `aui-dialog-${crypto.randomUUID()}`;
		customElements.define(definedName, class extends DialogElement {});
		const fixture = append(document.createElement("div"));
		fixture.insertAdjacentHTML(
			"beforeend",
			`<${definedName}><dialog aria-labelledby="parsed-title"><h2 id="parsed-title">Parsed</h2></dialog></${definedName}>`,
		);
		const parsed = fixture.lastElementChild as DialogElement;
		const parsedDialog = parsed.firstElementChild as HTMLDialogElement;
		expect(parsed.dialog).toBe(parsedDialog);
		expect(parsedDialog.getAttribute("aria-labelledby")).toBe("parsed-title");

		const lateName = `aui-dialog-${crypto.randomUUID()}`;
		expect(customElements.get(lateName)).toBeUndefined();
		fixture.insertAdjacentHTML("beforeend", `<${lateName}><dialog></dialog></${lateName}>`);
		const late = fixture.lastElementChild as DialogElement;
		const lateDialog = late.firstElementChild;
		customElements.define(lateName, class extends DialogElement {});
		expect(late).toBeInstanceOf(DialogElement);
		expect(late.dialog).toBe(lateDialog);
	});

	test("delegates modal focus and focus restoration to the native dialog", () => {
		const { dialog, element } = create();
		const opener = document.createElement("button");
		const initial = document.createElement("button");
		opener.textContent = "Open";
		initial.textContent = "Initial";
		initial.autofocus = true;
		element.before(opener);
		fixtures.push(opener);
		dialog.append(initial);
		opener.focus();

		element.showModal();
		expect(document.activeElement).toBe(initial);
		element.close();
		expect(document.activeElement).toBe(opener);
	});

	test("forwards native cancellation synchronously and preserves preventDefault", async () => {
		const { dialog, element } = create();
		const nativeCancel = vi.fn();
		const hostCancel = vi.fn((event: Event) => event.preventDefault());
		dialog.addEventListener("cancel", nativeCancel);
		element.addEventListener("cancel", hostCancel);
		element.showModal();

		await userEvent.keyboard("{Escape}");
		expect(nativeCancel).toHaveBeenCalledOnce();
		expect(hostCancel).toHaveBeenCalledOnce();
		expect(hostCancel.mock.calls[0]?.[0].bubbles).toBe(false);
		expect(hostCancel.mock.calls[0]?.[0].cancelable).toBe(true);
		expect(nativeCancel.mock.calls[0]?.[0].defaultPrevented).toBe(true);
		expect(dialog.open).toBe(true);
		element.close();
	});

	test("forwards the native queued close event after synchronous state changes", async () => {
		const { dialog, element } = create();
		const events: string[] = [];
		const closed = new Promise<void>((resolve) =>
			dialog.addEventListener(
				"close",
				() => {
					events.push("native");
					resolve();
				},
				{ once: true },
			),
		);
		element.addEventListener("close", (event) => {
			events.push("host");
			expect(event.bubbles).toBe(false);
			expect(event.cancelable).toBe(false);
		});
		element.show();

		element.close("accepted");
		expect(element.open).toBe(false);
		expect(element.returnValue).toBe("accepted");
		expect(events).toEqual([]);
		await closed;
		expect(events).toEqual(["host", "native"]);
	});

	test("uses the current document realm after adoption and child replacement", () => {
		const { dialog, element } = create();
		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		const FrameEvent = frameDocument?.defaultView?.Event;
		if (!frameDocument || !FrameEvent) {
			throw new Error("Same-origin iframe document is unavailable");
		}

		frameDocument.body.append(frameDocument.adoptNode(element));
		const replacement = frameDocument.createElement("dialog");
		dialog.replaceWith(replacement);
		expect(element.ownerDocument).toBe(frameDocument);
		expect(element.dialog).toBe(replacement);

		let forwarded: Event | undefined;
		element.addEventListener("close", (event) => (forwarded = event), { once: true });
		replacement.dispatchEvent(new FrameEvent("close"));
		expect(forwarded).toBeInstanceOf(FrameEvent);

		element.show();
		expect(replacement.open).toBe(true);
		element.close();
	});

	test("keeps native form method=dialog submission and return values", async () => {
		const { dialog, element } = create();
		const form = document.createElement("form");
		const submit = document.createElement("button");
		form.method = "dialog";
		submit.value = "save";
		submit.textContent = "Save";
		form.append(submit);
		dialog.append(form);
		const hostClose = vi.fn();
		const closed = closeEvent(dialog);
		element.addEventListener("close", hostClose);
		element.showModal();

		await userEvent.click(submit);
		expect(element.open).toBe(false);
		expect(element.returnValue).toBe("save");
		await closed;
		expect(hostClose).toHaveBeenCalledOnce();
	});

	test("uses native stacking and focus behavior for nested modal dialogs", () => {
		const outer = create();
		const inner = create();
		const innerOpener = document.createElement("button");
		const innerInitial = document.createElement("button");
		innerOpener.textContent = "Open nested";
		innerInitial.textContent = "Nested initial";
		innerInitial.autofocus = true;
		outer.dialog.append(innerOpener, inner.element);
		inner.dialog.append(innerInitial);

		outer.element.showModal();
		innerOpener.focus();
		inner.element.showModal();
		expect(outer.dialog.open).toBe(true);
		expect(inner.dialog.open).toBe(true);
		expect(document.activeElement).toBe(innerInitial);

		inner.element.close();
		expect(outer.dialog.open).toBe(true);
		expect(document.activeElement).toBe(innerOpener);
		outer.element.close();
	});

	test("releases removed children and reconnects without duplicate event forwarding", () => {
		const { dialog: first, element } = create();
		const replacement = document.createElement("dialog");
		const hostClose = vi.fn();
		element.addEventListener("close", hostClose);

		first.replaceWith(replacement);
		first.dispatchEvent(new Event("close"));
		expect(hostClose).not.toHaveBeenCalled();
		replacement.dispatchEvent(new Event("close"));
		expect(hostClose).toHaveBeenCalledOnce();

		element.remove();
		replacement.dispatchEvent(new Event("close"));
		expect(hostClose).toHaveBeenCalledOnce();
		document.body.append(element);
		replacement.dispatchEvent(new Event("close"));
		expect(hostClose).toHaveBeenCalledTimes(2);
	});
});
