import { afterEach, expect, test, vi } from "vitest";

import { benchmark } from "../../benchmark.js";
import { createRouter, route } from "../src/client-router.js";
import { fakeNavigation } from "../test/helpers.js";

const measurement = { samples: 8, warmup: 3 };

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

test("browser router ownership, route lookup, and subscriptions", async () => {
	fakeNavigation(location.origin);

	const routes = Array.from({ length: 32 }, (_, index) => route(`/projects/${index}`));
	const first = routes[0]!;
	const last = routes[31]!;
	const router = createRouter({ routes });
	let matched: unknown;
	let disposed = 0;
	let unsubscribed = 0;

	try {
		await benchmark(
			"client-router/ownership/create-dispose",
			() => {
				createRouter({ routes: [first] }).dispose();
				++disposed;
			},
			{ ...measurement, iterations: 12_000 },
		);

		expect(disposed).toBeGreaterThan(0);

		await benchmark(
			"client-router/match/first-of-32",
			() => {
				matched = router.match("https://example.test/projects/0");
			},
			{ ...measurement, iterations: 1_500 },
		);

		expect(matched).toMatchObject({ route: first });

		await benchmark(
			"client-router/match/last-of-32",
			() => {
				matched = router.match("https://example.test/projects/31");
			},
			{ ...measurement, iterations: 100 },
		);

		expect(matched).toMatchObject({ route: last });

		await benchmark(
			"client-router/match/miss-of-32",
			() => {
				matched = router.match("https://example.test/missing");
			},
			{ ...measurement, iterations: 100 },
		);

		expect(matched).toBeNull();

		await benchmark(
			"client-router/subscription/subscribe-unsubscribe",
			() => {
				const unsubscribe = router.subscribe(() => undefined);
				unsubscribe();
				++unsubscribed;
			},
			{ ...measurement, iterations: 30_000 },
		);

		expect(unsubscribed).toBeGreaterThan(0);

		await benchmark(
			"client-router/subscription/abort",
			() => {
				const controller = new AbortController();
				router.subscribe(() => undefined, { signal: controller.signal });
				controller.abort();
				++unsubscribed;
			},
			{ ...measurement, iterations: 2_500 },
		);

		expect(unsubscribed).toBeGreaterThan(0);
	} finally {
		router.dispose();
	}
});

test("browser router completed navigation", async () => {
	const navigation = fakeNavigation(location.origin);
	const plain = route("/plain");
	const blocking = route("/blocking", { loading: { mode: "blocking", load: () => 42 } });
	const deferred = route("/deferred", { loading: { mode: "deferred", load: () => 42 } });
	const router = createRouter({ routes: [plain, blocking, deferred] });
	let notifications = 0;

	await router.start();

	try {
		await benchmark(
			"client-router/navigation/no-loader",
			async () => {
				navigation.nextOptions = { hasUAVisualTransition: true };
				await router.navigate(plain).finished;
				navigation.events.length = 0;
				navigation.results.length = 0;
			},
			{ ...measurement, iterations: 500 },
		);

		expect(router.current).toMatchObject({ match: { route: plain }, status: "ready" });

		await benchmark(
			"client-router/navigation/blocking-loader",
			async () => {
				navigation.nextOptions = { hasUAVisualTransition: true };
				await router.navigate(blocking).finished;
				navigation.events.length = 0;
				navigation.results.length = 0;
			},
			{ ...measurement, iterations: 450 },
		);

		expect(router.current).toMatchObject({ match: { route: blocking }, status: "ready", data: 42 });

		await benchmark(
			"client-router/navigation/deferred-loader",
			async () => {
				navigation.nextOptions = { hasUAVisualTransition: true };
				await router.navigate(deferred).finished;
				navigation.events.length = 0;
				navigation.results.length = 0;
			},
			{ ...measurement, iterations: 350 },
		);

		expect(router.current).toMatchObject({ match: { route: deferred }, status: "ready", data: 42 });

		for (let index = 0; index < 8; ++index) {
			router.subscribe(() => {
				++notifications;
			});
		}

		await benchmark(
			"client-router/navigation/eight-subscribers",
			async () => {
				navigation.nextOptions = { hasUAVisualTransition: true };
				await router.navigate(plain).finished;
				navigation.events.length = 0;
				navigation.results.length = 0;
			},
			{ ...measurement, iterations: 450 },
		);

		expect(notifications).toBeGreaterThan(0);
		expect(router.current).toMatchObject({ match: { route: plain }, status: "ready" });
	} finally {
		router.dispose();
	}
});
