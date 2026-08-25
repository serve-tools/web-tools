import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { codec, route } from "../src/router.js";

const measurement = { samples: 8, warmup: 3 };

test("route declarations and codec ownership", async () => {
	let value: unknown;

	await benchmark(
		"router/codec/integer",
		() => {
			value = codec.integer();
		},
		{ ...measurement, iterations: 50_000 },
	);

	await benchmark(
		"router/codec/repeated-default",
		() => {
			value = codec.string().many().default(["one", "two", "three"]);
		},
		{ ...measurement, iterations: 20_000 },
	);

	await benchmark(
		"router/declaration/static",
		() => {
			value = route("/projects");
		},
		{ ...measurement, iterations: 2_000 },
	);

	await benchmark(
		"router/declaration/typed",
		() => {
			value = route("/projects/:id", {
				params: { id: codec.integer() },
				search: { page: codec.integer().default(1), tag: codec.string().many() },
			});
		},
		{ ...measurement, iterations: 1_500 },
	);

	expect(value).toMatchObject({ path: "/projects/:id" });
});

test("route URL generation and matching", async () => {
	const home = route("/projects");
	const project = route("/projects/:id", {
		params: { id: codec.integer() },
		search: {
			page: codec.integer().default(1),
			q: codec.string().optional(),
			tag: codec.string().many(),
		},
	});
	const browse = route("/browse/:kind", { params: { kind: codec.enum("new", "popular", "featured") } });
	const input = { params: { id: 42 }, search: { page: 2, q: "road map", tag: ["one", "two", "three"] } };
	let href = "";
	let matched: unknown;

	await benchmark(
		"router/href/static",
		() => {
			href = home.href();
		},
		{ ...measurement, iterations: 90_000 },
	);

	expect(href).toBe("/projects");

	await benchmark(
		"router/href/typed-search",
		() => {
			href = project.href(input);
		},
		{ ...measurement, iterations: 3_000 },
	);

	expect(href).toBe("/projects/42?page=2&q=road+map&tag=one&tag=two&tag=three");

	await benchmark(
		"router/match/static-hit",
		() => {
			matched = home.match("https://example.test/projects");
		},
		{ ...measurement, iterations: 10_000 },
	);

	expect(matched).toMatchObject({ route: home });

	await benchmark(
		"router/match/static-miss",
		() => {
			matched = home.match("https://example.test/missing");
		},
		{ ...measurement, iterations: 10_000 },
	);

	expect(matched).toBeNull();

	await benchmark(
		"router/match/typed-search-hit",
		() => {
			matched = project.match("https://example.test/projects/42?page=2&q=road+map&tag=one&tag=two&tag=three");
		},
		{ ...measurement, iterations: 750 },
	);

	expect(matched).toMatchObject({ params: { id: 42 }, search: { tag: ["one", "two", "three"] } });

	await benchmark(
		"router/match/typed-defaults",
		() => {
			matched = project.match("https://example.test/projects/42");
		},
		{ ...measurement, iterations: 1_000 },
	);

	expect(matched).toMatchObject({ search: { page: 1, q: undefined, tag: [] } });

	await benchmark(
		"router/match/path-miss",
		() => {
			matched = project.match("https://example.test/missing");
		},
		{ ...measurement, iterations: 3_000 },
	);

	expect(matched).toBeNull();

	await benchmark(
		"router/match/invalid-typed-value",
		() => {
			matched = project.match("https://example.test/projects/not-an-integer");
		},
		{ ...measurement, iterations: 2_000 },
	);

	expect(matched).toBeNull();

	await benchmark(
		"router/match/valid-enum-value",
		() => {
			matched = browse.match("https://example.test/browse/popular");
		},
		{ ...measurement, iterations: 2_000 },
	);

	expect(matched).toMatchObject({ route: browse, params: { kind: "popular" } });

	await benchmark(
		"router/match/invalid-enum-value",
		() => {
			matched = browse.match("https://example.test/browse/unknown");
		},
		{ ...measurement, iterations: 2_000 },
	);

	expect(matched).toBeNull();
});
