import { afterEach, describe, expect, test, vi } from "vitest";
import { AvatarElement } from "../../src/AvatarElement.js";

const fixtures: Node[] = [];
const loadedImage =
	"data:image/svg+xml," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2"/></svg>',
	);
const brokenImage = "data:image/png;base64,not-an-image";

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const defineAvatar = (): { element: AvatarElement; name: string } => {
	const name = `base-avatar-${crypto.randomUUID()}`;
	customElements.define(name, class extends AvatarElement {});
	return { element: document.createElement(name) as AvatarElement, name };
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

const fallback = (element: AvatarElement): HTMLSpanElement =>
	element.shadowRoot?.querySelector('[part="fallback"]') as HTMLSpanElement;

describe("AvatarElement", () => {
	test("retains fallback content and exposes exactly one image or fallback at a time", async () => {
		const { element } = defineAvatar();
		element.textContent = "AB";
		element.alt = "Ada Byron";
		append(element);

		expect(element.status).toBe("idle");
		expect(element.image.alt).toBe("Ada Byron");
		expect(element.image.hidden).toBe(true);
		expect(fallback(element).hidden).toBe(false);
		expect(element.textContent).toBe("AB");

		element.src = loadedImage;
		await vi.waitFor(() => expect(element.status).toBe("loaded"));
		expect(element.image.hidden).toBe(false);
		expect(fallback(element).hidden).toBe(true);
		expect(element.matches(":state(loaded)")).toBe(true);
		expect(element.matches(":state(fallback)")).toBe(false);

		element.removeAttribute("src");
		expect(element.status).toBe("idle");
		expect(element.image.hidden).toBe(true);
		expect(fallback(element).hidden).toBe(false);
		expect(element.textContent).toBe("AB");
	});

	test("uses native alt semantics without manufacturing a host role", async () => {
		const { element } = defineAvatar();
		element.textContent = "Decorative fallback";
		element.src = loadedImage;
		append(element);

		await vi.waitFor(() => expect(element.status).toBe("loaded"));
		expect(element.image.alt).toBe("");
		expect(element.hasAttribute("role")).toBe(false);
		expect(element.image.hasAttribute("role")).toBe(false);
		expect(fallback(element).hidden).toBe(true);

		element.alt = "Profile photo";
		expect(element.image.alt).toBe("Profile photo");
		element.setAttribute("aria-hidden", "true");
		expect(element.getAttribute("aria-hidden")).toBe("true");
	});

	test("delays fallback while loading and after an early error", async () => {
		const { element } = defineAvatar();
		element.textContent = "Fallback";
		element.delay = 80;
		element.src = brokenImage;
		append(element);

		expect(fallback(element).hidden).toBe(true);
		await vi.waitFor(() => expect(element.status).toBe("error"));
		expect(fallback(element).hidden).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(fallback(element).hidden).toBe(false);
		expect(element.matches(":state(error)")).toBe(true);
		expect(element.matches(":state(fallback)")).toBe(true);
	});

	test("ignores superseded source outcomes", async () => {
		const { element } = defineAvatar();
		element.textContent = "Fallback";
		append(element);

		element.src = brokenImage;
		element.src = loadedImage;
		await vi.waitFor(() => expect(element.status).toBe("loaded"));
		await new Promise<void>(queueMicrotask);
		expect(element.status).toBe("loaded");
		expect(element.image.getAttribute("src")).toBe(loadedImage);
		expect(fallback(element).hidden).toBe(true);
	});

	test("cancels pending work on disconnect and restarts without rebuilding", async () => {
		const { element } = defineAvatar();
		element.delay = 10_000;
		element.src = brokenImage;
		append(element);
		const image = element.image;
		const fallbackNode = fallback(element);
		element.remove();

		expect(element.status).toBe("idle");
		expect(element.image.hasAttribute("src")).toBe(false);
		await new Promise((resolve) => setTimeout(resolve, 25));
		expect(element.status).toBe("idle");

		document.body.append(element);
		expect(element.image).toBe(image);
		expect(fallback(element)).toBe(fallbackNode);
		await vi.waitFor(() => expect(element.status).toBe("error"));
	});

	test("clears a fallback timer that remains after an early image error", async () => {
		const setTimeout = vi.spyOn(window, "setTimeout");
		const clearTimeout = vi.spyOn(window, "clearTimeout");
		const { element } = defineAvatar();
		element.delay = 10_000;
		element.src = brokenImage;
		append(element);
		await vi.waitFor(() => expect(element.status).toBe("error"));
		expect(fallback(element).hidden).toBe(true);

		clearTimeout.mockClear();
		element.remove();
		expect(clearTimeout).toHaveBeenCalledOnce();
		expect(element.status).toBe("error");
		expect(fallback(element).hidden).toBe(false);

		setTimeout.mockClear();
		clearTimeout.mockClear();
		element.delay = 5_000;
		expect(setTimeout).not.toHaveBeenCalled();
		expect(clearTimeout).not.toHaveBeenCalled();
		expect(fallback(element).hidden).toBe(false);
	});

	test("does not settle a host request from an externally replaced image source", async () => {
		const { element } = defineAvatar();
		element.src = brokenImage;
		append(element);
		element.image.src = loadedImage;

		await element.image.decode();
		await new Promise<void>(queueMicrotask);
		expect(element.src).toBe(brokenImage);
		expect(element.image.getAttribute("src")).toBe(loadedImage);
		expect(element.status).toBe("loading");
		expect(element.matches(":state(loaded)")).toBe(false);
	});

	test("restarts relative image ownership after adoption while retaining nodes", async () => {
		const { element } = defineAvatar();
		element.src = loadedImage;
		append(element);
		await vi.waitFor(() => expect(element.status).toBe("loaded"));
		const image = element.image;

		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		if (!frameDocument) {
			throw new Error("Same-origin iframe document is unavailable");
		}
		frameDocument.body.append(frameDocument.adoptNode(element));
		expect(element.image).toBe(image);
		expect(element.image.ownerDocument).toBe(frameDocument);
		await vi.waitFor(() => expect(element.status).toBe("loaded"));
	});

	test("supports defined-before-parse and late-upgraded properties", async () => {
		const defined = defineAvatar();
		const fixture = append(document.createElement("div"));
		fixture.insertAdjacentHTML("beforeend", `<${defined.name} alt="Parsed">PA</${defined.name}>`);
		const parsed = fixture.lastElementChild as AvatarElement;
		expect(parsed.alt).toBe("Parsed");
		expect(parsed.textContent).toBe("PA");

		const lateName = `base-avatar-${crypto.randomUUID()}`;
		fixture.insertAdjacentHTML("beforeend", `<${lateName}>LA</${lateName}>`);
		const late = fixture.lastElementChild as AvatarElement;
		Object.defineProperty(late, "alt", { configurable: true, value: "Late" });
		Object.defineProperty(late, "src", { configurable: true, value: loadedImage });
		customElements.define(lateName, class extends AvatarElement {});
		expect(late).toBeInstanceOf(AvatarElement);
		expect(Object.hasOwn(late, "src")).toBe(false);
		expect(late.alt).toBe("Late");
		await vi.waitFor(() => expect(late.status).toBe("loaded"));
	});
});
