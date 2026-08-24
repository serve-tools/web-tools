import { describe, expect, it } from "vitest";
import { URLPattern } from "../src/ponyfill-urlpattern.js";

/** Offline cases modeled after urlpattern/resources/urlpatterntestdata.json. */
const componentNames = ["protocol", "username", "password", "hostname", "port", "pathname", "search", "hash"] as const;

type ComponentName = (typeof componentNames)[number];

interface MatchFixture {
	name: string;
	pattern: readonly unknown[];
	input: unknown;
	baseURL?: string;
	matches: boolean;
	groups?: Partial<Record<ComponentName, Record<string, string | undefined>>>;
	components?: Partial<Record<ComponentName, string>>;
}

function construct(args: readonly unknown[]): URLPattern {
	return Reflect.construct(URLPattern, args) as URLPattern;
}

function assertNativeFixture(fixture: MatchFixture): void {
	if (typeof globalThis.URLPattern !== "function") {
		return;
	}

	const pattern = Reflect.construct(globalThis.URLPattern, fixture.pattern);
	const args = fixture.baseURL === undefined ? [fixture.input] : [fixture.input, fixture.baseURL];
	const result = Reflect.apply(pattern.exec, pattern, args) as URLPatternResult | null;

	expect(Boolean(result), "native URLPattern fixture expectation").toBe(fixture.matches);

	if (!result) {
		return;
	}

	for (const [name, groups] of Object.entries(fixture.groups ?? {})) {
		expect(result[name as ComponentName].groups, `native ${name} groups`).toEqual(groups);
	}

	for (const [name, value] of Object.entries(fixture.components ?? {})) {
		expect(result[name as ComponentName].input, `native ${name} input`).toBe(value);
	}
}

function assertMatchFixture(fixture: MatchFixture): void {
	assertNativeFixture(fixture);

	const pattern = construct(fixture.pattern);
	const args = fixture.baseURL === undefined ? [fixture.input] : [fixture.input, fixture.baseURL];
	const testResult = Reflect.apply(pattern.test, pattern, args) as boolean;
	const result = Reflect.apply(pattern.exec, pattern, args) as URLPatternResult | null;

	expect(testResult).toBe(fixture.matches);
	expect(Boolean(result)).toBe(fixture.matches);

	if (!result) {
		return;
	}

	expect(result.inputs).toEqual(args);

	for (const name of componentNames) {
		expect(result[name]).toEqual({
			input: expect.any(String),
			groups: expect.any(Object),
		});
	}

	for (const [name, groups] of Object.entries(fixture.groups ?? {})) {
		expect(result[name as ComponentName].groups).toEqual(groups);
	}

	for (const [name, value] of Object.entries(fixture.components ?? {})) {
		expect(result[name as ComponentName].input).toBe(value);
	}
}

describe("URLPattern Web Platform Test-derived fixtures", () => {
	describe("component patterns", () => {
		const fixtures: MatchFixture[] = [
			{
				name: "matches an exact absolute URL pathname",
				pattern: ["https://example.com/books"],
				input: "https://example.com/books",
				matches: true,
			},
			{
				name: "rejects a different absolute URL origin",
				pattern: ["https://example.com/books"],
				input: "https://other.example/books",
				matches: false,
			},
			{
				name: "matches a constrained protocol",
				pattern: [{ protocol: "https", pathname: "/books" }],
				input: "https://example.com/books",
				matches: true,
			},
			{
				name: "rejects a different constrained protocol",
				pattern: [{ protocol: "https", pathname: "/books" }],
				input: "http://example.com/books",
				matches: false,
			},
			{
				name: "matches an exact hostname without constraining the protocol",
				pattern: [{ hostname: "example.com", pathname: "/books" }],
				input: "https://example.com/books",
				matches: true,
			},
			{
				name: "captures a named hostname component",
				pattern: [{ hostname: ":subdomain.example.com" }],
				input: "https://api.example.com/books",
				matches: true,
				groups: { hostname: { subdomain: "api" } },
			},
			{
				name: "captures a wildcard hostname component",
				pattern: [{ hostname: "*.example.com" }],
				input: "https://api.example.com/books",
				matches: true,
				groups: { hostname: { "0": "api" } },
			},
			{
				name: "matches an explicit non-default port",
				pattern: [{ protocol: "https", hostname: "example.com", port: "8443" }],
				input: "https://example.com:8443/books",
				matches: true,
			},
			{
				name: "rejects a different explicit port",
				pattern: [{ protocol: "https", hostname: "example.com", port: "8443" }],
				input: "https://example.com/books",
				matches: false,
			},
			{
				name: "matches constrained username and password",
				pattern: [{ username: "alice", password: "secret" }],
				input: "https://alice:secret@example.com/books",
				matches: true,
				components: { username: "alice", password: "secret" },
			},
			{
				name: "rejects nonmatching username and password",
				pattern: [{ username: "alice", password: "secret" }],
				input: "https://bob:wrong@example.com/books",
				matches: false,
			},
			{
				name: "captures a named search component",
				pattern: [{ search: "page=:page" }],
				input: "https://example.com/books?page=2",
				matches: true,
				groups: { search: { page: "2" } },
			},
			{
				name: "rejects a nonmatching search component",
				pattern: [{ search: "page=:page" }],
				input: "https://example.com/books?limit=2",
				matches: false,
			},
			{
				name: "captures a named hash component",
				pattern: [{ hash: "section-:section" }],
				input: "https://example.com/books#section-3",
				matches: true,
				groups: { hash: { section: "3" } },
			},
			{
				name: "rejects a nonmatching hash component",
				pattern: [{ hash: "section-:section" }],
				input: "https://example.com/books#appendix",
				matches: false,
			},
		];

		it.each(fixtures)("$name", assertMatchFixture);
	});

	describe("pattern grammar and captures", () => {
		const fixtures: MatchFixture[] = [
			{
				name: "captures a named pathname segment",
				pattern: [{ pathname: "/books/:id" }],
				input: "https://example.com/books/123",
				matches: true,
				groups: { pathname: { id: "123" } },
			},
			{
				name: "named pathname segments do not consume slashes",
				pattern: [{ pathname: "/books/:id" }],
				input: "https://example.com/books/123/extra",
				matches: false,
			},
			{
				name: "captures multiple named pathname segments",
				pattern: [{ pathname: "/users/:user/posts/:post" }],
				input: "https://example.com/users/alice/posts/42",
				matches: true,
				groups: { pathname: { user: "alice", post: "42" } },
			},
			{
				name: "preserves capture names that resemble generated group identifiers",
				pattern: [{ pathname: "/:g0" }],
				input: "https://example.com/books",
				matches: true,
				groups: { pathname: { g0: "books" } },
			},
			{
				name: "keeps anonymous captures independent of similarly named groups",
				pattern: [{ pathname: "/*/:g0" }],
				input: "https://example.com/books/123",
				matches: true,
				groups: { pathname: { "0": "books", g0: "123" } },
			},
			{
				name: "supports Unicode named capture identifiers",
				pattern: [{ pathname: "/:π" }],
				input: "https://example.com/books",
				matches: true,
				groups: { pathname: { π: "books" } },
			},
			{
				name: "captures a wildcard spanning pathname segments",
				pattern: [{ pathname: "/files/*" }],
				input: "https://example.com/files/images/photo.jpg",
				matches: true,
				groups: { pathname: { "0": "images/photo.jpg" } },
			},
			{
				name: "numbers multiple anonymous wildcard captures",
				pattern: [{ pathname: "/*/files/*" }],
				input: "https://example.com/docs/files/readme.md",
				matches: true,
				groups: { pathname: { "0": "docs", "1": "readme.md" } },
			},
			{
				name: "matches an optional named segment when present",
				pattern: [{ pathname: "/books/:id?" }],
				input: "https://example.com/books/123",
				matches: true,
				groups: { pathname: { id: "123" } },
			},
			{
				name: "matches an optional named segment when absent",
				pattern: [{ pathname: "/books/:id?" }],
				input: "https://example.com/books",
				matches: true,
				groups: { pathname: { id: undefined } },
			},
			{
				name: "matches a repeated named segment",
				pattern: [{ pathname: "/books/:id+" }],
				input: "https://example.com/books/a/b",
				matches: true,
				groups: { pathname: { id: "a/b" } },
			},
			{
				name: "matches a custom named regular-expression group",
				pattern: [{ pathname: "/books/:id(\\d+)" }],
				input: "https://example.com/books/123",
				matches: true,
				groups: { pathname: { id: "123" } },
			},
			{
				name: "rejects values excluded by a custom regular-expression group",
				pattern: [{ pathname: "/books/:id(\\d+)" }],
				input: "https://example.com/books/abc",
				matches: false,
			},
			{
				name: "captures an anonymous regular-expression group",
				pattern: [{ pathname: "/(books|articles)/:id" }],
				input: "https://example.com/articles/42",
				matches: true,
				groups: { pathname: { "0": "articles", id: "42" } },
			},
			{
				name: "matches an escaped literal pattern character",
				pattern: [{ pathname: "/books/\\:id" }],
				input: "https://example.com/books/:id",
				matches: true,
				groups: { pathname: {} },
			},
			{
				name: "matches an optional brace group when absent",
				pattern: [{ pathname: "/books{/archive}?" }],
				input: "https://example.com/books",
				matches: true,
				groups: { pathname: {} },
			},
			{
				name: "matches an optional brace group when present",
				pattern: [{ pathname: "/books{/archive}?" }],
				input: "https://example.com/books/archive",
				matches: true,
				groups: { pathname: {} },
			},
		];

		it.each(fixtures)("$name", assertMatchFixture);
	});

	describe("base URL inheritance and object inputs", () => {
		const fixtures: MatchFixture[] = [
			{
				name: "inherits the origin for a relative string constructor",
				pattern: ["/books/:id", "https://example.com/library/"],
				input: "https://example.com/books/123",
				matches: true,
			},
			{
				name: "rejects a different origin inherited from the string base",
				pattern: ["/books/:id", "https://example.com/library/"],
				input: "https://other.example/books/123",
				matches: false,
			},
			{
				name: "resolves a relative pathname against the base directory",
				pattern: ["books/:id", "https://example.com/library/"],
				input: "https://example.com/library/books/123",
				matches: true,
			},
			{
				name: "inherits the origin from an initializer baseURL",
				pattern: [{ pathname: "/books/:id", baseURL: "https://example.com/library/" }],
				input: "https://example.com/books/123",
				matches: true,
			},
			{
				name: "resolves a relative initializer pathname against its baseURL",
				pattern: [{ pathname: "books/:id", baseURL: "https://example.com/library/" }],
				input: "https://example.com/library/books/123",
				matches: true,
			},
			{
				name: "matches an initializer object without fabricating an origin",
				pattern: [{ pathname: "/books/:id" }],
				input: { pathname: "/books/123" },
				matches: true,
				groups: { pathname: { id: "123" }, protocol: { "0": "" }, hostname: { "0": "" } },
				components: { protocol: "", hostname: "", pathname: "/books/123" },
			},
			{
				name: "does not invent a pathname for an empty initializer object",
				pattern: [{ pathname: "/" }],
				input: {},
				matches: false,
			},
			{
				name: "inherits object-input components from its baseURL",
				pattern: [{ protocol: "https", hostname: "example.com", pathname: "/books/:id" }],
				input: { pathname: "/books/123", baseURL: "https://example.com/library/" },
				matches: true,
				groups: { pathname: { id: "123" } },
			},
			{
				name: "resolves string inputs with the method baseURL argument",
				pattern: [{ pathname: "/books/:id" }],
				input: "/books/123",
				baseURL: "https://example.com",
				matches: true,
				groups: { pathname: { id: "123" } },
			},
			{
				name: "returns false for an invalid string input",
				pattern: [{ pathname: "/books" }],
				input: "not an absolute URL",
				matches: false,
			},
		];

		it.each(fixtures)("$name", assertMatchFixture);
	});

	describe("URL canonicalization", () => {
		const fixtures: MatchFixture[] = [
			{
				name: "canonicalizes ASCII hostname case",
				pattern: [{ hostname: "EXAMPLE.COM" }],
				input: "https://example.com/books",
				matches: true,
				components: { hostname: "example.com" },
			},
			{
				name: "canonicalizes international domain names",
				pattern: [{ hostname: "bücher.example" }],
				input: "https://xn--bcher-kva.example/books",
				matches: true,
				components: { hostname: "xn--bcher-kva.example" },
			},
			{
				name: "canonicalizes a default HTTPS port",
				pattern: [{ protocol: "https", hostname: "example.com", port: "443" }],
				input: "https://example.com/books",
				matches: true,
				components: { port: "" },
			},
			{
				name: "percent-encodes spaces in pathname patterns",
				pattern: [{ pathname: "/hello world" }],
				input: "https://example.com/hello%20world",
				matches: true,
				components: { pathname: "/hello%20world" },
			},
			{
				name: "normalizes dot segments in pathname patterns",
				pattern: [{ pathname: "/books/../articles" }],
				input: "https://example.com/articles",
				matches: true,
				components: { pathname: "/articles" },
			},
			{
				name: "removes a leading question mark from initializer search",
				pattern: [{ search: "?page=:page" }],
				input: "https://example.com/books?page=2",
				matches: true,
				groups: { search: { page: "2" } },
			},
			{
				name: "removes a leading number sign from initializer hash",
				pattern: [{ hash: "#chapter-:chapter" }],
				input: "https://example.com/books#chapter-2",
				matches: true,
				groups: { hash: { chapter: "2" } },
			},
		];

		it.each(fixtures)("$name", assertMatchFixture);
	});

	describe("constructor properties and overloads", () => {
		it("defaults every component to a wildcard", () => {
			const pattern = construct([]);

			for (const name of componentNames) {
				expect(Reflect.get(pattern, name)).toBe("*");
			}
		});

		it("accepts explicitly undefined constructor input and options", () => {
			const pattern = construct([undefined, undefined]);

			expect(pattern.pathname).toBe("*");
			expect(pattern.protocol).toBe("*");
		});

		it("preserves explicit empty component patterns", () => {
			const pattern = construct([{ pathname: "/books", search: "", hash: "" }]);

			expect(pattern.search).toBe("");
			expect(pattern.hash).toBe("");
			expect(pattern.test("https://example.com/books")).toBe(true);
			expect(pattern.test("https://example.com/books?page=1")).toBe(false);
			expect(pattern.test("https://example.com/books#chapter")).toBe(false);
		});

		it("canonicalizes constructor component properties", () => {
			const pattern = construct([
				{
					protocol: "HTTPS",
					hostname: "EXAMPLE.COM",
					port: "443",
					pathname: "/hello world",
				},
			]);

			expect(pattern.protocol).toBe("https");
			expect(pattern.hostname).toBe("example.com");
			expect(pattern.port).toBe("");
			expect(pattern.pathname).toBe("/hello%20world");
		});

		it("exposes hasRegExpGroups for plain patterns", () => {
			expect(Reflect.get(construct([{ pathname: "/books/:id" }]), "hasRegExpGroups")).toBe(false);
		});

		it("exposes hasRegExpGroups for custom regular-expression patterns", () => {
			expect(Reflect.get(construct([{ pathname: "/books/:id(\\d+)" }]), "hasRegExpGroups")).toBe(true);
		});

		it("supports the initializer and options overload", () => {
			const pattern = construct([{ pathname: "/BOOKS/:id" }, { ignoreCase: true }]);

			expect(pattern.test("https://example.com/books/abc")).toBe(true);
		});

		it("supports the string, baseURL, and options overload", () => {
			const pattern = construct(["/BOOKS/:id", "https://example.com", { ignoreCase: true }]);

			expect(pattern.test("https://example.com/books/abc")).toBe(true);
			expect(pattern.test("https://other.example/books/abc")).toBe(false);
		});

		it("matches pathname patterns case-sensitively by default", () => {
			const pattern = construct([{ pathname: "/BOOKS" }]);

			expect(pattern.test("https://example.com/books")).toBe(false);
		});
	});

	describe("constructor validation", () => {
		const invalidConstructors: Array<{ name: string; args: readonly unknown[] }> = [
			{ name: "a relative string without a base URL", args: ["/books/:id"] },
			{ name: "an empty string without a base URL", args: [""] },
			{ name: "an invalid string base URL", args: ["/books", "not a URL"] },
			{ name: "an invalid initializer base URL", args: [{ baseURL: "not a URL" }] },
			{ name: "a relative initializer base URL", args: [{ baseURL: "/relative" }] },
			{
				name: "an initializer with a separate string base URL",
				args: [{ pathname: "/books" }, "https://example.com"],
			},
			{ name: "an invalid hostname", args: [{ hostname: "[invalid" }] },
			{ name: "an invalid port", args: [{ port: "99999" }] },
			{ name: "a nonnumeric literal port", args: [{ port: "abc" }] },
			{ name: "an unterminated regular expression", args: [{ pathname: "/books/:id([" }] },
			{ name: "a nested capturing regular-expression group", args: [{ pathname: "/books/:id((a))" }] },
			{ name: "duplicate named capture groups", args: [{ pathname: "/:id/:id" }] },
			{ name: "an unmatched brace", args: [{ pathname: "/books{" }] },
			{ name: "a numeric constructor input", args: [123] },
		];

		it.each(invalidConstructors)("rejects $name with TypeError", ({ name, args }) => {
			const nativeBaseURLDivergence =
				name === "an invalid initializer base URL" ||
				name === "a relative initializer base URL" ||
				name === "an unmatched brace";

			if (typeof globalThis.URLPattern === "function" && !nativeBaseURLDivergence) {
				expect(() => Reflect.construct(globalThis.URLPattern, args)).toThrow(TypeError);
			}

			expect(() => construct(args)).toThrow(TypeError);
		});
	});

	describe("result objects", () => {
		it("exposes independent wildcard captures for unspecified components", () => {
			const result = construct([{ pathname: "/books" }]).exec("https://example.com/books");

			expect(result).not.toBeNull();

			if (!result) {
				return;
			}

			expect(result.protocol.groups).toEqual({ "0": "https" });
			expect(result.hostname.groups).toEqual({ "0": "example.com" });
			expect(result.username.groups).toEqual({ "0": "" });
			expect(result.password.groups).toEqual({ "0": "" });
			expect(result.port.groups).toEqual({ "0": "" });
			expect(result.search.groups).toEqual({ "0": "" });
			expect(result.hash.groups).toEqual({ "0": "" });
			expect(result.pathname.groups).toEqual({});
			expect(result.protocol.groups).not.toBe(result.hostname.groups);
		});

		it("preserves object-input identity in the result inputs list", () => {
			const input = { pathname: "/books/123" };
			const result = construct([{ pathname: "/books/:id" }]).exec(input);

			expect(result?.inputs).toHaveLength(1);
			expect(result?.inputs[0]).toBe(input);
		});

		it("preserves the explicit method base URL in the result inputs list", () => {
			const result = construct([{ pathname: "/books/:id" }]).exec("/books/123", "https://example.com");

			expect(result?.inputs).toEqual(["/books/123", "https://example.com"]);
		});

		it("matches the default empty input when methods receive no arguments", () => {
			const pattern = construct([]);
			const testResult = Reflect.apply(pattern.test, pattern, []) as boolean;
			const result = Reflect.apply(pattern.exec, pattern, []) as URLPatternResult | null;

			expect(testResult).toBe(true);
			expect(result?.inputs).toEqual([{}]);

			for (const name of componentNames) {
				expect(result?.[name]).toEqual({ input: "", groups: { "0": "" } });
			}
		});

		it("rejects a dictionary input combined with a separate method base URL", () => {
			const pattern = construct([{ pathname: "/books/:id" }]);
			const input = { pathname: "/books/123" };

			if (typeof globalThis.URLPattern === "function") {
				const nativePattern = new globalThis.URLPattern({ pathname: "/books/:id" });

				expect(() => nativePattern.test(input, "https://example.com")).toThrow(TypeError);
				expect(() => nativePattern.exec(input, "https://example.com")).toThrow(TypeError);
			}

			expect(() => pattern.test(input, "https://example.com")).toThrow(TypeError);
			expect(() => pattern.exec(input, "https://example.com")).toThrow(TypeError);
		});
	});
});
