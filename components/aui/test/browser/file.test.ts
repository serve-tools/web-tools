import { afterEach, describe, expect, test } from "vitest";
import { FileElement } from "../../src/file-element.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
});

const file = (): { element: FileElement; input: HTMLInputElement } => {
	const name = `aui-file-${crypto.randomUUID()}`;
	customElements.define(name, class extends FileElement {});
	const element = document.createElement(name) as FileElement;
	const input = document.createElement("input");
	input.type = "file";
	element.append(input);
	document.body.append(element);
	fixtures.push(element);
	return { element, input };
};

describe("FileElement", () => {
	test("preserves the authored input as the sole native form identity and snapshots its files", () => {
		const { element, input } = file();
		const form = document.createElement("form");
		form.append(element);
		document.body.append(form);
		fixtures.push(form);
		input.name = "attachments";
		input.multiple = true;
		const selected = new File(["one"], "one.txt", { type: "text/plain" });
		element.files = [selected];
		expect(element.input).toBe(input);
		expect(element.files).toEqual([selected]);
		expect(Object.isFrozen(element.files)).toBe(true);
		expect(input.form).toBe(form);
		expect(form.elements).toHaveLength(1);
	});

	test("rejects oversized batches atomically without replacing selected files", () => {
		const { element } = file();
		element.files = [new File(["ok"], "ok.txt")];
		element.maxSize = 1;
		element.files = [new File(["too large"], "large.txt")];
		expect(element.files.map((selected) => selected.name)).toEqual(["ok.txt"]);
		expect(element.input?.validity.valid).toBe(false);
	});

	test("requires exactly one direct authored native file input", () => {
		const name = `aui-file-${crypto.randomUUID()}`;
		customElements.define(name, class extends FileElement {});
		const element = document.createElement(name) as FileElement;
		document.body.append(element);
		fixtures.push(element);
		expect(element.input).toBeNull();
		expect(() => element.pick()).toThrow("exactly one direct authored input[type=file]");
	});

	test("does not commit a stale or cancelled drop and prevents native default handling", () => {
		const { element } = file();
		const transfer = new DataTransfer();
		transfer.items.add(new File(["drop"], "drop.txt", { type: "text/plain" }));
		let drop: DragEvent | undefined;
		element.addEventListener(
			"beforechange",
			(event) => {
				drop = event.detail.sourceEvent;
				event.preventDefault();
			},
			{ once: true },
		);
		element.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer }));
		element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
		expect(drop?.defaultPrevented).toBe(true);
		expect(element.files).toEqual([]);
	});

	test("does not overwrite native input files authored during a drop proposal", () => {
		const { element, input } = file();
		const transfer = new DataTransfer();
		transfer.items.add(new File(["drop"], "drop.txt", { type: "text/plain" }));
		element.addEventListener(
			"beforechange",
			() => {
				const authored = new DataTransfer();
				authored.items.add(new File(["authored"], "authored.txt", { type: "text/plain" }));
				input.files = authored.files;
			},
			{ once: true },
		);
		element.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer }));
		element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
		expect(element.files.map((file) => file.name)).toEqual(["authored.txt"]);
	});

	test("does not emit stale change after an input listener directly replaces dropped files", () => {
		const { element, input } = file();
		const transfer = new DataTransfer();
		transfer.items.add(new File(["drop"], "drop.txt", { type: "text/plain" }));
		const events: string[] = [];
		input.addEventListener("input", () => {
			events.push("input");
			const authored = new DataTransfer();
			authored.items.add(new File(["authored"], "authored.txt", { type: "text/plain" }));
			input.files = authored.files;
		});
		input.addEventListener("change", () => events.push("change"));
		element.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer }));
		element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
		expect(element.files.map((file) => file.name)).toEqual(["authored.txt"]);
		expect(events).toEqual(["input"]);
	});

	test("refreshes wrapper validation after native form reset", async () => {
		const { element } = file();
		const form = document.createElement("form");
		form.append(element);
		document.body.append(form);
		fixtures.push(form);
		element.files = [new File(["large"], "large.txt")];
		element.maxSize = 1;
		expect(element.input?.validity.valid).toBe(false);
		form.reset();
		await Promise.resolve();
		expect(element.files).toEqual([]);
		expect(element.input?.validity.valid).toBe(true);
	});

	test("does not accept a user drop through a disabled fieldset and preserves replaced author validity", () => {
		const { element, input } = file();
		const fieldset = document.createElement("fieldset");
		fieldset.disabled = true;
		fieldset.append(element);
		document.body.append(fieldset);
		fixtures.push(fieldset);
		const transfer = new DataTransfer();
		transfer.items.add(new File(["drop"], "drop.txt"));
		element.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer }));
		element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
		expect(element.files).toEqual([]);
		fieldset.disabled = false;
		element.files = [new File(["large"], "large.txt")];
		element.maxSize = 1;
		input.setCustomValidity("Author reason");
		input.remove();
		expect(input.validationMessage).toBe("Author reason");
	});

	test("preflights invalid programmatic file brands before changing native validity", () => {
		const { element, input } = file();
		input.setCustomValidity("Author reason");
		expect(() => (element.files = [{ [Symbol.toStringTag]: "File" } as unknown as File])).toThrow(
			"File files must contain File objects",
		);
		const blob = new Blob(["not a file"]);
		Object.defineProperty(blob, Symbol.toStringTag, { value: "File" });
		expect(() => (element.files = [blob as unknown as File])).toThrow("File files must contain File objects");
		expect(input.validationMessage).toBe("Author reason");
	});

	test("keeps an authored input unchanged when pre-upgrade property recovery fails", () => {
		const name = `aui-file-${crypto.randomUUID()}`;
		const fixture = document.createElement("div");
		fixture.innerHTML = `<${name}><input type="file"></${name}>`;
		const element = fixture.firstElementChild as FileElement;
		const input = element.firstElementChild as HTMLInputElement;
		document.body.append(fixture);
		fixtures.push(fixture);
		const transfer = new DataTransfer();
		transfer.items.add(new File(["large"], "large.txt"));
		input.files = transfer.files;
		input.setCustomValidity("Author reason");
		Object.defineProperty(element, "maxSize", { configurable: true, value: 1 });
		const blob = new Blob(["not a file"]);
		Object.defineProperty(blob, Symbol.toStringTag, { value: "File" });
		Object.defineProperty(element, "files", { configurable: true, value: [blob] });
		const expectedMessage = "File files must contain File objects";
		let upgradeError: unknown;
		// Native failed upgrades report an error; some browser runners also print it before cancellation.
		// Handle only this expected failure so unrelated errors remain visible to the runner.
		const capture = (event: ErrorEvent): void => {
			if (!(event.error instanceof TypeError) || event.error.message !== expectedMessage) {
				return;
			}
			upgradeError = event.error;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener("error", capture, true);
		try {
			customElements.define(name, class extends FileElement {});
		} catch (error) {
			if (!(error instanceof TypeError) || error.message !== expectedMessage) {
				throw error;
			}
			upgradeError = error;
		} finally {
			window.removeEventListener("error", capture, true);
		}
		expect(upgradeError).toBeInstanceOf(TypeError);
		expect((upgradeError as Error | undefined)?.message).toBe(expectedMessage);
		expect(input.validationMessage).toBe("Author reason");
	});
});
