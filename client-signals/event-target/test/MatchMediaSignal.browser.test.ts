import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchMediaSignal } from "../src/signal-event-target.js";

describe("MatchMediaSignal", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("reads a native MediaQueryList and retains its query", () => {
		const query = "(min-width: 0px)";
		const current = new MatchMediaSignal(query);

		expect(current.query).toBe(query);
		expect(current.target.media).toBe(query);
		expect(current.get()).toBe(current.target.matches);
		expect(current.active).toBe(true);

		current.dispose();
	});

	it("updates after MediaQueryList change events", () => {
		const target = new MutableMediaQueryList("(orientation: landscape)");

		vi.stubGlobal("matchMedia", () => target as MediaQueryList);

		const current = new MatchMediaSignal("(orientation: landscape)");

		expect(current.get()).toBe(false);

		target.matches = true;
		target.dispatchEvent(new Event("change"));

		expect(current.get()).toBe(true);
		expect(current.target).toBe(target);

		current.dispose();
	});
});

class MutableMediaQueryList extends EventTarget {
	matches = false;
	onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => any) | null = null;

	constructor(readonly media: string) {
		super();
	}

	addListener(listener: ((this: MediaQueryList, event: MediaQueryListEvent) => any) | null): void {
		if (listener) this.addEventListener("change", listener as EventListener);
	}

	removeListener(listener: ((this: MediaQueryList, event: MediaQueryListEvent) => any) | null): void {
		if (listener) this.removeEventListener("change", listener as EventListener);
	}
}
