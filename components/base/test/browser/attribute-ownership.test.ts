import { describe, expect, test } from "vitest";
import { AttributeOwner } from "../../src/_ownership.js";

describe("shared attribute ownership", () => {
	test("releases unchanged attributes without generating mutation records", () => {
		const element = document.createElement("input");
		element.setAttribute("aria-label", "authored");
		const owner = new AttributeOwner();
		const observer = new MutationObserver(() => {});
		observer.observe(element, { attributes: true });
		try {
			owner.own(element, "aria-label", "authored");
			owner.own(element, "aria-describedby", null);
			owner.release(element);
			expect(observer.takeRecords()).toEqual([]);
			expect(element.getAttribute("aria-label")).toBe("authored");
			expect(element.hasAttribute("aria-describedby")).toBe(false);
		} finally {
			observer.disconnect();
		}
	});

	test("restores the latest captured author value and preserves later external writes", () => {
		const element = document.createElement("input");
		const owner = new AttributeOwner();
		element.setAttribute("aria-label", "initial");
		owner.own(element, "aria-label", "managed");
		element.setAttribute("aria-label", "updated");
		owner.own(element, "aria-label", "managed-again");
		owner.release(element);
		expect(element.getAttribute("aria-label")).toBe("updated");

		owner.own(element, "aria-label", "managed");
		element.removeAttribute("aria-label");
		owner.release(element);
		expect(element.hasAttribute("aria-label")).toBe(false);

		owner.own(element, "aria-describedby", "temporary");
		owner.release(element);
		expect(element.hasAttribute("aria-describedby")).toBe(false);
	});
});
