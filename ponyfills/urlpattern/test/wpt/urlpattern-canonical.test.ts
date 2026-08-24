import { describe, expect, it } from "vitest";
import { URLPattern } from "../../src/ponyfill-urlpattern.js";
import knownFailingFixtures from "./known-failing.json";
import fixtures from "./urlpatterntestdata.json";

const components = ["protocol", "username", "password", "hostname", "port", "pathname", "search", "hash"] as const;

type Component = (typeof components)[number];
type Initializer = Record<string, unknown>;

interface ComponentResult {
	input: string;
	groups: Record<string, string | null | undefined>;
}

interface Fixture {
	pattern: unknown[];
	inputs?: unknown[];
	expected_obj?: "error" | Record<string, string>;
	expected_match?: "error" | null | ({ inputs?: unknown[] } & Partial<Record<Component, ComponentResult>>);
	exactly_empty_components?: string[];
}

const earlierComponents: Record<Component, Component[]> = {
	protocol: [],
	hostname: ["protocol"],
	port: ["protocol", "hostname"],
	username: [],
	password: [],
	pathname: ["protocol", "hostname", "port"],
	search: ["protocol", "hostname", "port", "pathname"],
	hash: ["protocol", "hostname", "port", "pathname", "search"],
};

function expectedPattern(fixture: Fixture, component: Component): string {
	if (typeof fixture.expected_obj === "object" && fixture.expected_obj[component] !== undefined) {
		return fixture.expected_obj[component];
	}

	const initializer =
		typeof fixture.pattern[0] === "object" && fixture.pattern[0] !== null
			? (fixture.pattern[0] as Initializer)
			: undefined;
	const baseValue = initializer?.baseURL ?? (typeof fixture.pattern[1] === "string" ? fixture.pattern[1] : undefined);
	const baseURL = typeof baseValue === "string" ? new URL(baseValue) : undefined;

	if (fixture.exactly_empty_components?.includes(component)) {
		return "";
	}

	if (initializer?.[component]) {
		return String(initializer[component]);
	}

	if (initializer && earlierComponents[component].some((name) => name in initializer)) {
		return "*";
	}

	if (!baseURL || component === "username" || component === "password") {
		return "*";
	}

	const value = baseURL[component];

	if (component === "protocol") {
		return value.slice(0, -1);
	}

	return component === "search" || component === "hash" ? value.slice(1) : value;
}

function expectedResult(fixture: Fixture, component: Component): ComponentResult {
	const expected =
		typeof fixture.expected_match === "object" && fixture.expected_match !== null
			? fixture.expected_match[component]
			: undefined;

	if (!expected) {
		return {
			input: "",
			groups: fixture.exactly_empty_components?.includes(component) ? {} : { "0": "" },
		};
	}

	return {
		input: expected.input,
		groups: Object.fromEntries(Object.entries(expected.groups).map(([name, value]) => [name, value ?? undefined])),
	};
}

describe("canonical URLPattern Web Platform Tests", () => {
	const strict = typeof process !== "undefined" && process.env.WPT_STRICT === "1";
	const knownFailures = new Set<number>(knownFailingFixtures);

	for (const [index, fixture] of (fixtures as Fixture[]).entries()) {
		const test = knownFailures.has(index) && !strict ? it.fails : it;

		test(`fixture ${index}`, () => {
			if (fixture.expected_obj === "error") {
				expect(() => Reflect.construct(URLPattern, fixture.pattern)).toThrow(TypeError);
				return;
			}

			const pattern = Reflect.construct(URLPattern, fixture.pattern) as URLPattern;

			for (const component of components) {
				expect(Reflect.get(pattern, component), `${component} pattern`).toBe(
					expectedPattern(fixture, component),
				);
			}

			const inputs = fixture.inputs ?? [];

			if (fixture.expected_match === "error") {
				expect(() => Reflect.apply(pattern.test, pattern, inputs)).toThrow(TypeError);
				expect(() => Reflect.apply(pattern.exec, pattern, inputs)).toThrow(TypeError);
				return;
			}

			expect(Reflect.apply(pattern.test, pattern, inputs), "test() result").toBe(Boolean(fixture.expected_match));

			const actual = Reflect.apply(pattern.exec, pattern, inputs) as URLPatternResult | null;

			if (!fixture.expected_match) {
				expect(actual, "exec() result").toBeNull();
				return;
			}

			expect(actual, "exec() result").not.toBeNull();

			if (!actual) {
				return;
			}

			expect(actual.inputs, "result inputs").toEqual(fixture.expected_match.inputs ?? inputs);

			for (const component of components) {
				expect(actual[component], `${component} result`).toEqual(expectedResult(fixture, component));
			}
		});
	}
});
