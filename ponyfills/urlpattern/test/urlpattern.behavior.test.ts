import { describe, expect, it } from "vitest";
import { URLPattern } from "../src/ponyfill-urlpattern.js";

describe("URLPattern matching compatibility regressions", () => {
	describe("pattern validation", () => {
		it("rejects pathname patterns ending in an escape character", () => {
			expect(() => new URLPattern({ pathname: "/foo\\" })).toThrow(TypeError);
		});

		it("validates constructor base URLs even when the pattern is absolute", () => {
			expect(() => new URLPattern("https://example.com/foo", "not a URL")).toThrow(TypeError);
		});

		it("ignores valid constructor base URLs when the pattern is absolute", () => {
			const pattern = new URLPattern("https://example.com/foo", "https://other.example/base");

			expect(pattern.hostname).toBe("example.com");
			expect(pattern.pathname).toBe("/foo");
		});

		it("rejects protected optional delimiters in absolute string patterns", () => {
			expect(() => new URLPattern("https://example.com/a\u0001b")).toThrow(TypeError);
		});

		it.each([
			{ character: "\u0002", pathname: "/a", search: "b" },
			{ character: "\u0003", pathname: "/a/b", search: "*" },
		])(
			"preserves protected delimiters in absolute string patterns: $character",
			({ character, pathname, search }) => {
				const pattern = new URLPattern(`https://example.com/a${character}b`);

				expect(pattern.pathname).toBe(pathname);
				expect(pattern.search).toBe(search);
			},
		);
	});

	describe("canonical pathname serialization", () => {
		it.each([
			{ character: "{", encoded: "%7B" },
			{ character: "}", encoded: "%7D" },
		])("percent-encodes escaped $character literals and pathname dictionary inputs", ({ character, encoded }) => {
			const pattern = new URLPattern({ pathname: `/foo\\${character}` });
			const result = pattern.exec({ pathname: `/foo${character}` });

			expect(pattern.pathname).toBe(`/foo${encoded}`);
			expect(result?.pathname).toEqual({ input: `/foo${encoded}`, groups: {} });
		});

		it.each([
			{ pathname: ":café\\bar", canonical: "{:café}bar" },
			{ pathname: "{:名}{bar(.*)}", canonical: ":名{bar*}" },
			{ pathname: "{:名}?(.*)", canonical: ":名?*" },
			{ pathname: "{:café\\.bar}", canonical: "{:café.bar}" },
			{ pathname: "/:名\\bar", canonical: "{/:名}bar" },
			{ pathname: "x:名\\bar", canonical: "x{:名}bar" },
			{
				pathname: "/articles/{:article}{-:revision}?",
				canonical: "/articles/{:article}{-:revision}?",
			},
			{ pathname: "{:foo}{x}?", canonical: "{:foo}{x}?" },
			{ pathname: "{:foo}{x}*", canonical: "{:foo}{x}*" },
			{ pathname: "{:foo}{a\\*b}?", canonical: "{:foo}{a\\*b}?" },
			{ pathname: "{:foo}{a\\:b}?", canonical: "{:foo}{a\\:b}?" },
			{ pathname: "/{:foo}?", canonical: "/{:foo}?" },
			{ pathname: "/{:foo}*", canonical: "/{:foo}*" },
			{ pathname: "{:foo}*", canonical: ":foo*" },
		])("canonicalizes grouped parameter names: $pathname", ({ pathname, canonical }) => {
			expect(new URLPattern({ pathname }).pathname).toBe(canonical);
		});

		it("preserves escaped punctuation inside custom regular-expression groups", () => {
			const pattern = new URLPattern({ pathname: "/:id(foo\\.bar)" });

			expect(pattern.pathname).toBe("/:id(foo\\.bar)");
			expect(pattern.hasRegExpGroups).toBe(true);
			expect(pattern.test({ pathname: "/foo.bar" })).toBe(true);
			expect(pattern.test({ pathname: "/fooXbar" })).toBe(false);
		});

		it.each([
			"/:id(foo\\.bar\\})",
			"/:id((?:foo\\.bar\\}))",
			"/:id(.*\\/*)",
			"/:id(a*\\/*b)",
			"/:id(:foo\\bar)",
			"/:id(x:foo\\bar)",
		])("preserves escaped punctuation before braces inside custom groups: %s", (pathname) => {
			expect(new URLPattern({ pathname }).pathname).toBe(pathname);
		});

		it.each([
			"/:id(\\{)",
			"/:id(a\\}b)",
			"/:id(\\{foo(?:bar))",
			"/:id(\\{foo(?:(?:bar)))",
			"/:id(a\\}b(?:(?:foo)))",
		])("preserves escaped braces in custom groups: %s", (pathname) => {
			const pattern = new URLPattern({ pathname });

			expect(pattern.pathname).toBe(pathname);
			expect(pattern.hasRegExpGroups).toBe(true);
		});

		it.each([
			{ pathname: "/foo\\{\\)", canonical: "/foo%7B\\)" },
			{ pathname: "/foo\\{bar\\)", canonical: "/foo%7Bbar\\)" },
		])("percent-encodes literal braces before escaped parentheses: $pathname", ({ pathname, canonical }) => {
			expect(new URLPattern({ pathname }).pathname).toBe(canonical);
		});

		it("preserves optional wildcard captures after canonical serialization", () => {
			const pattern = new URLPattern({ pathname: "*{}**?" });

			expect(pattern.pathname).toBe("*(.*)?");
			expect(pattern.exec({ pathname: "foobar" })?.pathname.groups).toEqual({
				0: "foobar",
				1: undefined,
			});
		});

		it.each([
			{ component: "pathname", value: "/foo/:bar(.*)" },
			{ component: "pathname", value: "/foo/([^\\/]+?)" },
			{ component: "hostname", value: ":domain(.*)" },
		])("does not classify built-in $component groups as custom regular expressions", ({ component, value }) => {
			const pattern = new URLPattern({ [component]: value });

			expect(pattern.hasRegExpGroups).toBe(false);
		});

		it("classifies non-delimited reluctant groups as custom regular expressions", () => {
			expect(new URLPattern({ search: "(.+?)" }).hasRegExpGroups).toBe(true);
		});
	});

	describe("valid hostname patterns", () => {
		it.each(["\t", "\n", "\r"])("normalizes ASCII whitespace in a string pattern hostname: %j", (character) => {
			const pattern = new URLPattern(`https://exa${character}mple.com/books`);

			expect(pattern.hostname).toBe("example.com");
			expect(pattern.test("https://example.com/books")).toBe(true);
		});

		it("accepts hostname groups spanning the apparent pathname boundary", () => {
			const pattern = new URLPattern("https://{sub.}?example{.com/}foo");

			expect(pattern.hostname).toBe("{sub.}?example.com");
			expect(pattern.pathname).toBe("*");
			expect(pattern.test("https://example.com/foo")).toBe(true);
			expect(pattern.exec("https://example.com/foo")?.pathname.groups).toEqual({ 0: "/foo" });
		});

		it("accepts regular-expression hostname groups containing a slash without matching them", () => {
			const pattern = new URLPattern("https://(sub.)?example(.com/)foo");

			expect(pattern.hostname).toBe("(sub.)?example(.com/)foo");
			expect(pattern.pathname).toBe("*");
			expect(pattern.test("https://example.com/foo")).toBe(false);
			expect(pattern.exec("https://example.com/foo")).toBeNull();
		});

		it("accepts nested noncapturing regular-expression groups in hostnames", () => {
			const pattern = new URLPattern("https://(sub(?:.))?example.com/foo");

			expect(pattern.hostname).toBe("(sub(?:.))?example.com");
			expect(pattern.test("https://example.com/foo")).toBe(true);
			expect(pattern.exec("https://example.com/foo")?.hostname.groups).toEqual({
				0: undefined,
			});
		});
	});

	describe("credential and escaped-delimiter patterns", () => {
		it("captures named username and password patterns independently", () => {
			const pattern = new URLPattern("https://:user::pass@example.com");
			const result = pattern.exec("https://foo:bar@example.com");

			expect(pattern.username).toBe(":user");
			expect(pattern.password).toBe(":pass");
			expect(pattern.test("https://foo:bar@example.com")).toBe(true);
			expect(result?.username.groups).toEqual({ user: "foo" });
			expect(result?.password.groups).toEqual({ pass: "bar" });
		});

		it("matches escaped protocol and credential separators", () => {
			const pattern = new URLPattern("https\\:foo\\:bar@example.com");
			const result = pattern.exec("https:foo:bar@example.com");

			expect(pattern.protocol).toBe("https");
			expect(pattern.username).toBe("foo");
			expect(pattern.password).toBe("bar");
			expect(pattern.hostname).toBe("example.com");
			expect(pattern.test("https:foo:bar@example.com")).toBe(true);
			expect(result?.username.input).toBe("foo");
			expect(result?.password.input).toBe("bar");
		});

		it("accepts an escaped username colon without treating it as a password separator", () => {
			const pattern = new URLPattern("https://foo{\\:}bar@example.com");

			expect(pattern.username).toBe("foo%3Abar");
			expect(pattern.password).toBe("*");
			expect(pattern.test("https://foo:bar@example.com")).toBe(false);
			expect(pattern.exec("https://foo:bar@example.com")).toBeNull();
		});

		it("resolves a grouped escaped colon as a relative pathname", () => {
			const pattern = new URLPattern("data{\\:}channel.html", "https://example.com");

			expect(pattern.protocol).toBe("https");
			expect(pattern.hostname).toBe("example.com");
			expect(pattern.pathname).toBe("/data\\:channel.html");
			expect(pattern.test("https://example.com/data:channel.html")).toBe(true);
			expect(pattern.exec("https://example.com/data:channel.html")?.pathname.input).toBe("/data:channel.html");
		});
	});

	describe("IPv6 hostname capture groups", () => {
		it("captures a named trailing IPv6 segment", () => {
			const pattern = new URLPattern({ hostname: "{[\\:\\:ab\\::num]}" });
			const input = { hostname: "[::ab:1]" };

			expect(pattern.test(input)).toBe(true);
			expect(pattern.exec(input)?.hostname.groups).toEqual({ num: "1" });
		});

		it("captures a named middle IPv6 segment", () => {
			const pattern = new URLPattern({ hostname: "{[\\:\\::num\\:1]}" });
			const input = { hostname: "[::ab:1]" };

			expect(pattern.test(input)).toBe(true);
			expect(pattern.exec(input)?.hostname.groups).toEqual({ num: "ab" });
		});
	});

	describe("input normalization and opaque URLs", () => {
		it("matches null input as an empty dictionary", () => {
			const pattern = new URLPattern();
			const result = Reflect.apply(pattern.exec, pattern, [null]) as ReturnType<typeof pattern.exec>;

			expect(Reflect.apply(pattern.test, pattern, [null])).toBe(true);
			expect(result?.inputs).toEqual([{}]);
			expect(result?.pathname).toEqual({ input: "", groups: { 0: "" } });
		});

		it("matches pathname-only string input without a base URL", () => {
			const pattern = new URLPattern({ pathname: "/foo" });
			const result = pattern.exec("/foo");

			expect(pattern.test("/foo")).toBe(true);
			expect(result?.inputs).toEqual(["/foo"]);
			expect(result?.pathname).toEqual({ input: "/foo", groups: {} });
			expect(result?.protocol).toEqual({ input: "", groups: { 0: "" } });
		});

		it("rejects an overridden protocol when the base URL has a different scheme", () => {
			const pattern = new URLPattern("https://example.com/foo?bar#baz");
			const input = {
				protocol: "https:",
				search: "?bar",
				hash: "#baz",
				baseURL: "http://example.com/foo",
			};

			expect(pattern.test(input)).toBe(false);
			expect(pattern.exec(input)).toBeNull();
		});

		it("matches opaque data URL pathnames containing an absent optional named segment", () => {
			const pattern = new URLPattern("data\\:text/javascript,let x = 100/:tens?5;");
			const input = "data:text/javascript,let x = 100/5;";

			expect(pattern.protocol).toBe("data");
			expect(pattern.pathname).toBe("text/javascript,let x = 100/:tens?5;");
			expect(pattern.test(input)).toBe(true);
			expect(pattern.exec(input)?.pathname.groups).toEqual({ tens: undefined });
		});
	});

	describe("dictionary input base URL credential inheritance", () => {
		const baseURL = "https://alice:secret@example.com:8443/path";

		it.each([
			{ component: "hostname", input: { hostname: "other.example", baseURL } },
			{ component: "port", input: { port: "9443", baseURL } },
		])("clears inherited credentials when overriding $component", ({ input }) => {
			const pattern = new URLPattern({ username: "", password: "" });
			const result = pattern.exec(input);

			expect(pattern.test(input)).toBe(true);
			expect(result?.username.input).toBe("");
			expect(result?.password.input).toBe("");
		});

		it.each([
			{
				component: "hostname",
				input: { hostname: "other.example", username: "bob", password: "replacement", baseURL },
			},
			{
				component: "port",
				input: { port: "9443", username: "bob", password: "replacement", baseURL },
			},
		])("preserves explicitly supplied credentials when overriding $component", ({ input }) => {
			const pattern = new URLPattern({ username: "bob", password: "replacement" });
			const result = pattern.exec(input);

			expect(pattern.test(input)).toBe(true);
			expect(result?.username.input).toBe("bob");
			expect(result?.password.input).toBe("replacement");
		});

		it("clears the inherited password when overriding the username", () => {
			const pattern = new URLPattern({ username: "bob", password: "" });
			const input = { username: "bob", baseURL };
			const result = pattern.exec(input);

			expect(pattern.test(input)).toBe(true);
			expect(result?.username.input).toBe("bob");
			expect(result?.password.input).toBe("");
		});

		it("preserves the inherited username when overriding the password", () => {
			const pattern = new URLPattern({ username: "alice", password: "replacement" });
			const input = { password: "replacement", baseURL };
			const result = pattern.exec(input);

			expect(pattern.test(input)).toBe(true);
			expect(result?.username.input).toBe("alice");
			expect(result?.password.input).toBe("replacement");
		});
	});
});
