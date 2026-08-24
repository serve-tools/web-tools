import { describe, expect, it } from "vitest";
import { URLPattern } from "../src/ponyfill-urlpattern.js";

describe("URLPattern web-standard conformance", () => {
	describe("component defaults and canonicalization", () => {
		it("defaults every unspecified component to a wildcard", () => {
			const pattern = new URLPattern();

			expect(pattern.protocol).toBe("*");
			expect(pattern.username).toBe("*");
			expect(pattern.password).toBe("*");
			expect(pattern.hostname).toBe("*");
			expect(pattern.port).toBe("*");
			expect(pattern.pathname).toBe("*");
			expect(pattern.search).toBe("*");
			expect(pattern.hash).toBe("*");
		});

		it("canonicalizes hostnames without imposing a protocol", () => {
			const pattern = new URLPattern({ hostname: "EXAMPLE.COM" });

			expect(pattern.protocol).toBe("*");
			expect(pattern.hostname).toBe("example.com");
			expect(pattern.test("https://example.com/path")).toBe(true);
			expect(pattern.test("http://example.com/path")).toBe(true);
		});

		it("normalizes a protocol's explicit default port", () => {
			const pattern = new URLPattern({
				protocol: "https",
				hostname: "example.com",
				port: "443",
				pathname: "/",
			});

			expect(pattern.port).toBe("");
			expect(pattern.test("https://example.com/")).toBe(true);
		});

		it("percent-encodes Unicode pathname literals", () => {
			const pattern = new URLPattern({ pathname: "/café" });

			expect(pattern.pathname).toBe("/caf%C3%A9");
			expect(pattern.test("https://example.com/caf%C3%A9")).toBe(true);
		});
	});

	describe("component matching", () => {
		it("matches protocol independently of the other components", () => {
			const pattern = new URLPattern({ protocol: "https", pathname: "/books" });

			expect(pattern.test("https://example.com/books")).toBe(true);
			expect(pattern.test("http://example.com/books")).toBe(false);
		});

		it("matches username and password components", () => {
			const pattern = new URLPattern({ username: "user", password: "pass" });

			expect(pattern.test("https://user:pass@example.com/")).toBe(true);
			expect(pattern.test("https://user:wrong@example.com/")).toBe(false);
		});

		it("matches hostname wildcards and captures the matching subdomain", () => {
			const pattern = new URLPattern({ hostname: "*.example.com" });
			const result = pattern.exec("https://api.example.com/");

			expect(result?.hostname.input).toBe("api.example.com");
			expect(result?.hostname.groups).toEqual({ 0: "api" });
			expect(pattern.test("https://example.org/")).toBe(false);
		});

		it("matches and captures search parameters", () => {
			const pattern = new URLPattern({ search: "q=:query" });
			const result = pattern.exec("https://example.com/?q=hello");

			expect(result?.search.input).toBe("q=hello");
			expect(result?.search.groups).toEqual({ query: "hello" });
			expect(pattern.test("https://example.com/?other=hello")).toBe(false);
		});

		it("matches and captures hash fragments", () => {
			const pattern = new URLPattern({ hash: "item-:id" });
			const result = pattern.exec("https://example.com/#item-42");

			expect(result?.hash.input).toBe("item-42");
			expect(result?.hash.groups).toEqual({ id: "42" });
			expect(pattern.test("https://example.com/#other-42")).toBe(false);
		});

		it("separates pathname, search, and hash in string patterns", () => {
			const pattern = new URLPattern("https://example.com/books?q=:query#item-:id");
			const result = pattern.exec("https://example.com/books?q=yes#item-2");

			expect(pattern.pathname).toBe("/books");
			expect(pattern.search).toBe("q=:query");
			expect(pattern.hash).toBe("item-:id");
			expect(result?.search.groups).toEqual({ query: "yes" });
			expect(result?.hash.groups).toEqual({ id: "2" });
		});

		it("captures wildcard matches in each unspecified component", () => {
			const result = new URLPattern({ pathname: "/books/:id" }).exec("https://example.com/books/42?q=yes#top");

			expect(result?.protocol.groups).toEqual({ 0: "https" });
			expect(result?.username.groups).toEqual({ 0: "" });
			expect(result?.password.groups).toEqual({ 0: "" });
			expect(result?.hostname.groups).toEqual({ 0: "example.com" });
			expect(result?.port.groups).toEqual({ 0: "" });
			expect(result?.pathname.groups).toEqual({ id: "42" });
			expect(result?.search.groups).toEqual({ 0: "q=yes" });
			expect(result?.hash.groups).toEqual({ 0: "top" });
		});
	});

	describe("pathname pattern syntax", () => {
		it("matches named pathname groups", () => {
			const pattern = new URLPattern({ pathname: "/users/:id/posts/:post" });
			const result = pattern.exec("https://example.com/users/42/posts/first");

			expect(result?.pathname.groups).toEqual({ id: "42", post: "first" });
			expect(pattern.test("https://example.com/users/42/posts/first/extra")).toBe(false);
		});

		it("allows an optional named segment to be absent or present", () => {
			const pattern = new URLPattern({ pathname: "/books/:id?" });

			expect(pattern.exec("https://example.com/books")?.pathname.groups).toEqual({
				id: undefined,
			});
			expect(pattern.exec("https://example.com/books/42")?.pathname.groups).toEqual({ id: "42" });
		});

		it("captures repeated named pathname segments", () => {
			const pattern = new URLPattern({ pathname: "/books/:path+" });

			expect(pattern.exec("https://example.com/books/a/b")?.pathname.groups).toEqual({
				path: "a/b",
			});
			expect(pattern.test("https://example.com/books")).toBe(false);
		});

		it("supports custom regular-expression groups", () => {
			const pattern = new URLPattern({ pathname: "/books/:id(\\d+)" });

			expect(pattern.exec("https://example.com/books/42")?.pathname.groups).toEqual({ id: "42" });
			expect(pattern.test("https://example.com/books/letters")).toBe(false);
			expect(Reflect.get(pattern, "hasRegExpGroups")).toBe(true);
		});

		it("reports when no custom regular-expression groups are present", () => {
			const pattern = new URLPattern({ pathname: "/books/:id" });

			expect(Reflect.get(pattern, "hasRegExpGroups")).toBe(false);
		});

		it("treats escaped syntax characters as literals", () => {
			const pattern = new URLPattern({ pathname: "/time\\:value" });

			expect(pattern.test("https://example.com/time:value")).toBe(true);
			expect(pattern.test("https://example.com/time-other")).toBe(false);
		});
	});

	describe("base URLs and input handling", () => {
		it("resolves relative string patterns against their constructor base URL", () => {
			const pattern = new URLPattern("/books/:id", "https://example.com/root/");

			expect(pattern.protocol).toBe("https");
			expect(pattern.hostname).toBe("example.com");
			expect(pattern.exec("https://example.com/books/42")?.pathname.groups).toEqual({ id: "42" });
			expect(pattern.test("https://other.example/books/42")).toBe(false);
		});

		it("resolves relative initialization pathnames against the base pathname", () => {
			const pattern = new URLPattern({
				baseURL: "https://example.com/root/start?old=1#old",
				pathname: "child",
			});

			expect(pattern.pathname).toBe("/root/child");
			expect(pattern.test("https://example.com/root/child")).toBe(true);
		});

		it("resolves relative string inputs against a supplied match base URL", () => {
			const pattern = new URLPattern({ pathname: "/books/:id" });
			const result = pattern.exec("/books/42", "https://example.com/root/");

			expect(result?.inputs).toEqual(["/books/42", "https://example.com/root/"]);
			expect(result?.pathname.groups).toEqual({ id: "42" });
		});

		it("matches component dictionaries without inventing URL components", () => {
			const result = new URLPattern({ pathname: "/books" }).exec({ pathname: "/books" });

			expect(result?.protocol.input).toBe("");
			expect(result?.hostname.input).toBe("");
			expect(result?.pathname.input).toBe("/books");
		});

		it("returns null and false for invalid input URLs", () => {
			const pattern = new URLPattern({ pathname: "/books" });

			expect(pattern.exec("not an absolute URL")).toBeNull();
			expect(pattern.test("not an absolute URL")).toBe(false);
		});
	});

	describe("constructor validation and options", () => {
		it("rejects relative string patterns without a base URL", () => {
			expect(() => new URLPattern("/books")).toThrow(TypeError);
		});

		it("rejects invalid initialization base URLs", () => {
			expect(() => new URLPattern({ baseURL: "not a URL", pathname: "/books" })).toThrow(TypeError);
		});

		it("rejects malformed regular-expression groups", () => {
			expect(() => new URLPattern({ pathname: "/books/:id(" })).toThrow(TypeError);
		});

		it("supports case-insensitive matching through constructor options", () => {
			const pattern = Reflect.construct(URLPattern, [{ pathname: "/BOOKS" }, { ignoreCase: true }]);

			expect(pattern.test("https://example.com/books")).toBe(true);
		});
	});
});
