import { afterEach, describe, expect, it, vi } from "vitest";
import { codec, createRouter, route } from "../src/client-router.js";
import { fakeNavigation } from "./helpers.js";

const precommitDescriptor = Object.getOwnPropertyDescriptor(globalThis, "NavigationPrecommitController");

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	if (precommitDescriptor === undefined) {
		Reflect.deleteProperty(globalThis, "NavigationPrecommitController");
	} else {
		Object.defineProperty(globalThis, "NavigationPrecommitController", precommitDescriptor);
	}
});

describe("browser router", () => {
	it("requires the current realm to provide the Navigation API", () => {
		vi.stubGlobal("navigation", undefined);
		const router = createRouter({ routes: [route("/")] });

		expect(() => router.start()).toThrow(TypeError);
	});

	it("reuses the same codec instance for pathname and search parameters", () => {
		const identifier = codec.integer();
		const project = route("/projects/:id", {
			params: { id: identifier },
			search: { parentId: identifier },
		});

		expect(project.options.params?.id).toBe(identifier);
		expect(project.options.search?.parentId).toBe(identifier);
		expect(project.href({ params: { id: 42 }, search: { parentId: 7 } })).toBe("/projects/42?parentId=7");
		expect(project.match("/projects/42?parentId=7")).toMatchObject({
			params: { id: 42 },
			search: { parentId: 7 },
		});
	});

	it("replaces its installed route list when authorization changes", async () => {
		const home = route("/");
		const identifier = codec.integer();
		const project = route("/projects/:id", {
			params: { id: identifier },
			search: { parentId: identifier.optional() },
		});
		const publicRoutes = [home] as const;
		const privateRoutes = [home, project] as const;
		const authenticated = false as boolean;
		const navigation = fakeNavigation();
		const router = createRouter({
			routes: authenticated ? privateRoutes : publicRoutes,
		});

		expect(router.match("https://example.test/")?.route).toBe(home);
		expect(router.match("https://example.test/projects/42")).toBeNull();
		expect(() => router.navigate(project, { params: { id: 42 } })).toThrow("uninstalled route");

		router.setRoutes(privateRoutes);
		expect(router.match("https://example.test/projects/42")?.params).toEqual({ id: 42 });
		expect(router.match("https://example.test/projects/42?parentId=7")?.search).toEqual({ parentId: 7 });

		await router.start();
		const result = router.navigate(project, { params: { id: 7 } });
		expect(result).toBe(navigation.results[0]);
		expect(new URL((await result.finished).url!).pathname).toBe("/projects/7");
	});

	it("lets native navigation resolve route URLs for non-HTTP documents", async () => {
		const page = route("/page");
		const navigation = fakeNavigation("file:///tmp/current.html");
		const navigate = vi.spyOn(navigation, "navigate");
		const router = createRouter({ routes: [page] });
		await router.start();

		const result = router.navigate(page);

		expect(navigate).toHaveBeenCalledWith("/page", undefined);
		expect((await result.finished).url).toBe("file:///page");
		expect(navigation.events[0]?.canIntercept).toBe(false);
	});

	it("snapshots construction and replacement lists", () => {
		const home = route("/");
		const other = route("/other");
		fakeNavigation();
		const initial: Array<typeof home | typeof other> = [home];
		const router = createRouter({ routes: initial });

		initial.splice(0, 1, other);
		expect(router.match("https://example.test/")?.route).toBe(home);
		expect(router.match("https://example.test/other")).toBeNull();

		const replacement: Array<typeof home | typeof other> = [other];
		router.setRoutes(replacement);
		replacement.splice(0, 1, home);
		expect(router.match("https://example.test/")).toBeNull();
		expect(router.match("https://example.test/other")?.route).toBe(other);
	});

	it("uses list order for overlapping routes and permits duplicate identities", () => {
		const parameterized = route("/:name");
		const fixed = route("/fixed");
		fakeNavigation();
		const router = createRouter({
			routes: [parameterized, fixed, parameterized],
		});

		expect(router.match("https://example.test/fixed")?.route).toBe(parameterized);
		router.setRoutes([fixed, parameterized, parameterized]);
		expect(router.match("https://example.test/fixed")?.route).toBe(fixed);
	});

	it("atomically validates retained redirects and supports an empty route list", () => {
		const home = route("/");
		const login = route("/login");
		fakeNavigation();
		const router = createRouter({
			routes: [home, login],
			unmatched: { mode: "redirect", route: login },
		});

		expect(() => router.setRoutes([])).toThrow("redirect route must be installed");
		expect(router.match("https://example.test/")?.route).toBe(home);
		router.setRoutes([], { unmatched: { mode: "preserve" } });
		expect(router.match("https://example.test/")).toBeNull();
		expect(() => router.navigate(home)).toThrow("uninstalled route");
	});

	it("does not cancel in-flight work when a route replacement is rejected", async () => {
		const prepared = Promise.withResolvers<string>();
		const page = route("/page", { loading: { mode: "blocking", load: () => prepared.promise } });
		const login = route("/login");
		fakeNavigation("https://example.test/page");
		const router = createRouter({
			routes: [page, login],
			unmatched: { mode: "redirect", route: login },
		});
		const started = router.start();
		await Promise.resolve();

		expect(() => router.setRoutes([page])).toThrow("redirect route must be installed");
		prepared.resolve("ready");

		await expect(started).resolves.toBeUndefined();
		expect(router.current).toMatchObject({ status: "ready", data: "ready" });
	});

	it("uses genuine precommit loading for blocking routes when the platform exposes it", async () => {
		Object.defineProperty(globalThis, "NavigationPrecommitController", { configurable: true, value: class {} });
		const prepared = Promise.withResolvers<string>();
		const load = vi.fn(() => prepared.promise);
		const page = route("/page", { loading: { mode: "blocking", load } });
		const navigation = fakeNavigation();
		const rendered = vi.fn();
		const router = createRouter({ routes: [page], render: rendered });
		await router.start();

		const result = router.navigate(page);
		await Promise.resolve();
		expect(navigation.events[0]?.interceptOptions?.precommitHandler).toBeTypeOf("function");
		expect(navigation.currentEntry).toBeNull();
		expect(rendered).not.toHaveBeenCalled();

		prepared.resolve("prepared");
		expect(new URL((await result.committed).url!).pathname).toBe("/page");
		await result.finished;
		expect(load).toHaveBeenCalledOnce();
		expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ data: "prepared" }));
	});

	it.each(["blocking", "deferred"] as const)(
		"presents a %s route without a loader as ready without a precommit handler",
		async (mode) => {
			Object.defineProperty(globalThis, "NavigationPrecommitController", { configurable: true, value: class {} });
			const page = route("/page", { loading: { mode } });
			const navigation = fakeNavigation();
			const statuses: string[] = [];
			const router = createRouter({
				routes: [page],
				render: ({ current }) => {
					statuses.push(current.status);
				},
			});

			await router.start();
			await router.navigate(page).finished;

			expect(statuses).toEqual(["ready"]);
			expect(router.current).toMatchObject({ status: "ready", data: undefined });
			expect(Object.isFrozen(router.current)).toBe(true);
			expect(navigation.events[0]?.interceptOptions?.precommitHandler).toBeUndefined();
			expect(navigation.events[0]?.scrollCalls).toBe(1);
		},
	);

	it("restarts an initial route without a loader after being stopped", async () => {
		const page = route("/page");
		fakeNavigation("https://example.test/page");
		const render = vi.fn();
		const router = createRouter({ routes: [page], render });
		const initial = router.start();

		expect(router.start()).toBe(initial);
		await initial;
		expect(router.current).toMatchObject({ status: "ready", data: undefined });

		router.stop();

		const restarted = router.start();

		expect(restarted).not.toBe(initial);
		await restarted;
		expect(render).toHaveBeenCalledTimes(2);
		expect(router.current?.match.route).toBe(page);
	});

	it("prepares a blocking redirect target before committing its redirected URL", async () => {
		Object.defineProperty(globalThis, "NavigationPrecommitController", { configurable: true, value: class {} });
		const prepared = Promise.withResolvers<string>();
		const login = route("/login", { loading: { mode: "blocking", load: () => prepared.promise } });
		const navigation = fakeNavigation();
		const rendered = vi.fn();
		const router = createRouter({
			routes: [login],
			unmatched: { mode: "redirect", route: login },
			render: rendered,
		});
		await router.start();

		const result = navigation.navigate("/missing");
		await Promise.resolve();
		expect(navigation.events[0]?.interceptOptions?.precommitHandler).toBeTypeOf("function");
		expect(navigation.currentEntry).toBeNull();

		prepared.resolve("login");
		expect(new URL((await result.committed).url!).pathname).toBe("/login");
		await result.finished;
		expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ data: "login" }));
	});

	it("presents deferred loading state after commit and then presents its data", async () => {
		const prepared = Promise.withResolvers<string>();
		const page = route("/page", { loading: { mode: "deferred", load: () => prepared.promise } });
		const navigation = fakeNavigation();
		const statuses: string[] = [];
		const router = createRouter({
			routes: [page],
			render: ({ current }) => {
				statuses.push(current.status);
			},
		});
		await router.start();

		const result = router.navigate(page);
		await result.committed;
		await vi.waitFor(() => expect(statuses).toEqual(["loading"]));
		expect(navigation.events[0]?.scrollCalls).toBe(1);

		prepared.resolve("ready");
		await result.finished;
		expect(statuses).toEqual(["loading", "ready"]);
		expect(router.current).toMatchObject({ status: "ready", data: "ready" });
		expect(navigation.events[0]?.scrollCalls).toBe(1);
	});

	it("passes hash-only and unmatched destinations through by default", async () => {
		const home = route("/");
		const navigation = fakeNavigation();
		const render = vi.fn();
		const router = createRouter({ routes: [home], render });
		await router.start();

		navigation.nextOptions = { hashChange: true };
		const unmatched = router.navigate(home);
		await unmatched.finished;

		const documentResult = navigation.navigate("/missing");
		await documentResult.finished;
		expect(navigation.events[1]?.interceptOptions).toBeUndefined();
	});

	it("intercepts unmatched destinations only when preserve mode owns them", async () => {
		const home = route("/");
		const navigation = fakeNavigation();
		const router = createRouter({
			routes: [home],
			unmatched: { mode: "preserve" },
		});
		await router.start();

		await navigation.navigate("/missing").finished;
		expect(navigation.events[0]?.interceptOptions?.scroll).toBe("manual");
		expect(navigation.events[0]?.interceptOptions?.focusReset).toBe("manual");
		expect(navigation.events[0]?.scrollCalls).toBe(1);
	});

	it("reports subscriber failures through the platform reportError global", async () => {
		const home = route("/");
		fakeNavigation("https://example.test/");
		const router = createRouter({ routes: [home] });
		const reported = vi.fn();
		const subscriber = vi.fn();
		const failure = new Error("subscriber failed");
		vi.stubGlobal("reportError", reported);
		router.subscribe(() => {
			throw failure;
		});
		router.subscribe(subscriber);

		await router.start();

		expect(reported).toHaveBeenCalledWith(failure);
		expect(subscriber).toHaveBeenCalledWith(router.current);
	});

	it("clears stale current state when its route is removed", async () => {
		const home = route("/");
		const other = route("/other");
		fakeNavigation("https://example.test/");
		const router = createRouter({ routes: [home, other] });
		const subscriber = vi.fn();
		router.subscribe(subscriber);
		await router.start();
		expect(router.current?.match.route).toBe(home);

		router.setRoutes([other]);
		expect(router.current).toBeNull();
		expect(subscriber).toHaveBeenLastCalledWith(null);
	});

	it("prevents an initial loader from overwriting a newer navigation", async () => {
		const prepared = Promise.withResolvers<string>();
		const slow = route("/slow", { loading: { mode: "blocking", load: () => prepared.promise } });
		const fast = route("/fast");
		fakeNavigation(`${globalThis.location?.origin || "https://example.test"}/slow`);
		const router = createRouter({ routes: [slow, fast] });
		const initial = router.start();
		void initial.catch(() => undefined);
		await Promise.resolve();

		await router.navigate(fast).finished;
		prepared.resolve("late");

		await expect(initial).rejects.toMatchObject({ name: "AbortError" });
		expect(router.current?.match.route).toBe(fast);
	});

	it("invalidates in-flight work before replacing the installed routes", async () => {
		const prepared = Promise.withResolvers<string>();
		const slow = route("/slow", { loading: { mode: "blocking", load: () => prepared.promise } });
		const other = route("/other");
		fakeNavigation(`${globalThis.location?.origin || "https://example.test"}/slow`);
		const router = createRouter({ routes: [slow, other] });
		const initial = router.start();
		void initial.catch(() => undefined);
		await Promise.resolve();

		router.setRoutes([other]);
		prepared.resolve("late");

		await expect(initial).rejects.toMatchObject({ name: "AbortError" });
		expect(router.current).toBeNull();
	});

	it("rolls current state back when rendering fails", async () => {
		const page = route("/page");
		fakeNavigation();
		const router = createRouter({
			routes: [page],
			render: () => {
				throw new Error("render failed");
			},
		});
		await router.start();

		await expect(router.navigate(page).finished).rejects.toThrow("render failed");
		expect(router.current).toBeNull();
	});

	it("requires redirect routes to be installed", () => {
		const home = route("/");
		const login = route("/login");
		const authenticated = false as boolean;
		fakeNavigation();

		expect(() =>
			createRouter({
				routes: authenticated ? ([home, login] as const) : ([home] as const),
				unmatched: { mode: "redirect", route: login },
			}),
		).toThrow("redirect route must be installed");
	});

	it("passes cross-origin destinations through even when their paths match", async () => {
		const page = route("/page");
		const navigation = fakeNavigation("https://example.test/");
		const router = createRouter({ routes: [page] });
		await router.start();

		await navigation.navigate("https://elsewhere.test/page").finished;
		expect(navigation.events[0]?.interceptOptions).toBeUndefined();
	});

	it("removes subscription signal listeners and makes disposal terminal", async () => {
		const home = route("/");
		fakeNavigation();
		const router = createRouter({ routes: [home] });
		const controller = new AbortController();
		const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");
		const unsubscribe = router.subscribe(() => undefined, { signal: controller.signal });

		unsubscribe();
		expect(removeEventListener).toHaveBeenCalledWith("abort", unsubscribe);

		const retainedController = new AbortController();
		const retainedRemove = vi.spyOn(retainedController.signal, "removeEventListener");
		const retainedUnsubscribe = router.subscribe(() => undefined, { signal: retainedController.signal });
		await router.start();
		router.dispose();
		expect(retainedRemove).toHaveBeenCalledWith("abort", retainedUnsubscribe);
		expect(() => router.start()).toThrow("disposed router");
		expect(() => router.subscribe(() => undefined)).toThrow("disposed router");
	});
});
