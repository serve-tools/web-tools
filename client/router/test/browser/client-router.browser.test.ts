import { afterEach, expect, test, vi } from "vitest";
import { createRouter, route } from "../../src/client-router.js";
import { fakeNavigation } from "../helpers.js";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

test("renders and scrolls inside the view-transition update before awaiting its animation", async () => {
	const order: string[] = [];
	const page = route("/page");
	const navigation = fakeNavigation(location.origin);
	navigation.onScroll = () => order.push("scroll");
	vi.spyOn(document, "startViewTransition").mockImplementation((update): ViewTransition => {
		const updateCallbackDone = Promise.resolve().then(async () => {
			if (typeof update === "function") {
				await update();
			}
			order.push("snapshot");
		});
		const finished = updateCallbackDone.then(() => {
			order.push("animation-finished");
		});

		return {
			finished,
			ready: Promise.resolve(),
			updateCallbackDone,
			skipTransition: vi.fn(),
		} as unknown as ViewTransition;
	});
	const router = createRouter({
		routes: [page],
		render: () => {
			order.push("render");
		},
	});
	await router.start();

	const result = router.navigate(page);
	await result.finished;

	expect(order).toEqual(["render", "scroll", "snapshot", "animation-finished"]);
});

test("does not stack a document view transition over a user-agent visual transition", async () => {
	const page = route("/page");
	const navigation = fakeNavigation(location.origin);
	navigation.nextOptions = { hasUAVisualTransition: true };
	const startViewTransition = vi.spyOn(document, "startViewTransition");
	const router = createRouter({ routes: [page] });
	await router.start();

	await router.navigate(page).finished;

	expect(startViewTransition).not.toHaveBeenCalled();
	expect(navigation.events[0]?.scrollCalls).toBe(1);
});

test("skips an ongoing view transition when a newer navigation cancels it", async () => {
	const first = route("/first");
	const second = route("/second");
	const navigation = fakeNavigation(location.origin);
	const animation = Promise.withResolvers<void>();
	const skipTransition = vi.fn(() => animation.resolve());
	vi.spyOn(document, "startViewTransition").mockImplementation((update): ViewTransition => {
		const updateCallbackDone = Promise.resolve().then(async () => {
			if (typeof update === "function") {
				await update();
			}
		});

		return {
			finished: updateCallbackDone.then(() => animation.promise),
			ready: Promise.resolve(),
			updateCallbackDone,
			skipTransition,
		} as unknown as ViewTransition;
	});
	const router = createRouter({ routes: [first, second] });
	await router.start();

	const superseded = router.navigate(first);
	void superseded.finished.catch(() => undefined);
	await vi.waitFor(() => expect(navigation.events[0]?.scrollCalls).toBe(1));
	const succeeding = router.navigate(second);
	await succeeding.finished;

	expect(skipTransition).toHaveBeenCalled();
	await expect(superseded.finished).rejects.toMatchObject({ name: "AbortError" });
});

test.runIf("navigation" in window)("starts against the browser's real Navigation API", async () => {
	const currentURL = new URL(window.navigation.currentEntry?.url ?? location.href);
	const currentRoute = route(currentURL.pathname);
	const render = vi.fn();
	const router = createRouter({ routes: [currentRoute], render });

	try {
		await router.start();
		expect(router.current?.match.url.pathname).toBe(currentURL.pathname);
		expect(render).toHaveBeenCalledOnce();
		expect(router.transition).toBe(window.navigation.transition);
	} finally {
		router.stop();
	}
});

test.runIf("navigation" in window).each(["reload", "scope-change"] as const)(
	"preserves a real document load for %s",
	async (kind) => {
		const frame = document.createElement("iframe");
		const loaded = () =>
			new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
		const initialLoad = loaded();
		frame.src = new URL("./navigation.html", import.meta.url).href;
		document.body.append(frame);

		try {
			await initialLoad;
			await vi.waitFor(() => expect(frame.contentDocument?.body?.dataset.ready).toBe("true"));
			const initial = frame.contentDocument;
			const target = frame.contentWindow;
			expect(target).not.toBeNull();

			const nextLoad = loaded();
			if (kind === "reload") {
				target!.location.reload();
			} else {
				target!.location.href = `${frame.src}?document=true`;
			}

			await nextLoad;
			await vi.waitFor(() => {
				expect(frame.contentDocument).not.toBe(initial);
				expect(frame.contentDocument?.body?.dataset.ready).toBe("true");
			});
			expect(frame.contentDocument?.body.dataset.renders).toBe("1");
			if (kind === "scope-change") {
				expect(target!.location.search).toBe("?document=true");
			}
		} finally {
			frame.remove();
		}
	},
);
