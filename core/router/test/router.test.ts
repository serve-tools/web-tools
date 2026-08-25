import { describe, expect, it } from "vitest";

import { codec, route } from "../src/router.js";

describe("route", () => {
	it("builds and matches typed path and search values", () => {
		const project = route("/projects/:id", {
			params: { id: codec.integer() },
			search: {
				tab: codec.enum("overview", "files").default("overview"),
				tag: codec.string().many(),
				q: codec.string().optional(),
			},
			loading: { mode: "blocking" },
		});

		expect(project.href({ params: { id: 42 }, search: { q: "road map", tag: ["one", "two"] } })).toBe(
			"/projects/42?tag=one&tag=two&q=road+map",
		);

		const match = project.match("https://example.com/projects/42?q=road+map&tag=one&tag=two");
		expect(match).toEqual({
			route: project,
			url: new URL("https://example.com/projects/42?q=road+map&tag=one&tag=two"),
			params: { id: 42 },
			search: { tab: "overview", tag: ["one", "two"], q: "road map" },
		});
	});

	it("keeps undeclared path parameters as strings", () => {
		const article = route("/authors/:author/articles/:slug", {
			params: { author: codec.integer() },
		});

		expect(article.match("/authors/7/articles/hello%20world")?.params).toEqual({
			author: 7,
			slug: "hello world",
		});
		expect(article.href({ params: { author: 7, slug: "hello world" } })).toBe("/authors/7/articles/hello%20world");
	});

	it("keeps type and runtime parameter names aligned around literal affixes", () => {
		const asset = route("/assets/:id.:format-:variant");

		expect(asset.href({ params: { id: "logo", format: "svg", variant: "dark" } })).toBe("/assets/logo.svg-dark");
		expect(asset.match("/assets/logo.svg-dark")?.params).toEqual({ id: "logo", format: "svg", variant: "dark" });
	});

	it("round trips encoded slashes and rejects malformed escapes", () => {
		const file = route("/files/:key");
		const href = file.href({ params: { key: "folder/name" } });

		expect(href).toBe("/files/folder%2Fname");
		expect(file.match(href)?.params.key).toBe("folder/name");
		expect(file.match("/files/%E0%A4%A")).toBeNull();
	});

	it("canonicalizes literal Unicode and spaces while preserving href-match round trips", () => {
		const localized = route("/café menu/:item");
		const href = localized.href({ params: { item: "crème brûlée" } });

		expect(href).toBe("/caf%C3%A9%20menu/cr%C3%A8me%20br%C3%BBl%C3%A9e");
		expect(localized.match(href)?.params.item).toBe("crème brûlée");
	});

	it("matches encoded URL objects independently of their authority, search, and hash", () => {
		const localized = route("/café menu/:item", {
			search: { filter: codec.string().optional() },
		});
		const input = new URL(
			"https://name:secret@example.test:8443/caf%C3%A9%20menu/folder%2Fname?filter=red+blue#details",
		);
		const match = localized.match(input)!;

		expect(match.url).not.toBe(input);
		expect(match.url.href).toBe(input.href);
		expect(match.params).toEqual({ item: "folder/name" });
		expect(match.search).toEqual({ filter: "red blue" });
	});

	it("supports argument-free hrefs when all inputs are optional", () => {
		const home = route("/");
		const listing = route("/projects", {
			search: { page: codec.integer().default(1), q: codec.string().optional() },
		});

		expect(home.href()).toBe("/");
		expect(listing.href()).toBe("/projects");
		expect(listing.match("/projects")?.search).toEqual({ page: 1, q: undefined });
	});

	it("requires non-optional scalar search values and rejects duplicate scalars", () => {
		const lookup = route("/lookup", { search: { page: codec.integer() } });

		expect(lookup.match("/lookup")).toBeNull();
		expect(lookup.match("/lookup?page=1&page=2")).toBeNull();
		expect(lookup.match("/lookup?page=01")).toBeNull();
		expect(lookup.match("/lookup?page=2")?.search).toEqual({ page: 2 });
		expect(lookup.match(`/lookup?page=${Number.MAX_SAFE_INTEGER + 1}`)).toBeNull();
		expect(() => lookup.href({ search: { page: 1.5 } })).toThrow(TypeError);
		expect(() => lookup.href({ search: { page: Number.MAX_SAFE_INTEGER + 1 } })).toThrow(TypeError);
	});

	it("rejects invalid enum values while preserving repeated-value order", () => {
		const browse = route("/browse", {
			search: {
				kind: codec.enum("new", "popular"),
				id: codec.integer().many(),
			},
		});

		expect(browse.match("/browse?kind=other")).toBeNull();
		expect(browse.match("/browse?kind=new&id=3&id=1")?.search).toEqual({ kind: "new", id: [3, 1] });
	});

	it("accepts portable custom schemas", () => {
		const upper = {
			parse(value: string) {
				if (value !== value.toUpperCase()) {
					throw new TypeError("not uppercase");
				}

				return value as Uppercase<string>;
			},
			format(value: Uppercase<string>) {
				return value;
			},
		};
		const custom = route("/custom/:code", {
			params: { code: codec.schema(upper) },
			search: { value: codec.schema(upper).optional() },
		});

		expect(custom.match("/custom/ABC?value=XYZ")?.params.code).toBe("ABC");
		expect(custom.match("/custom/abc")).toBeNull();
	});

	it("retains portable loading configuration", async () => {
		const loaded = route("/items/:id", {
			params: { id: codec.integer() },
			loading: {
				mode: "deferred",
				load: ({ params, signal }) => ({ id: params.id, aborted: signal.aborted }),
			},
		});
		const match = loaded.match("/items/4")!;
		const controller = new AbortController();

		expect(await loaded.options.loading?.load?.({ ...match, signal: controller.signal })).toEqual({
			id: 4,
			aborted: false,
		});
	});

	it("validates route declarations and href inputs", () => {
		expect(() => route("relative" as `/${string}`, {})).toThrow(TypeError);
		expect(() => route("//attacker.example", {})).toThrow(TypeError);
		expect(() => route("/line\nbreak", {})).toThrow(TypeError);
		expect(() => route("/items/:id?", {})).toThrow(TypeError);
		expect(() => route("/time\\:value", {})).toThrow(TypeError);
		expect(() => route("/items/:", {})).toThrow(TypeError);
		expect(() => route("/items/:1", {})).toThrow(TypeError);
		expect(() => route("/items/:é", {})).toThrow(TypeError);
		expect(() => route("/items/%69d", {})).toThrow(TypeError);
		expect(() => route("/items/:id/:id", {})).toThrow(TypeError);

		const item = route("/items/:id", {});
		expect(() => item.href({ params: {} as { id: string } })).toThrow(TypeError);
		expect(() => item.href({ params: { id: null } } as never)).toThrow(TypeError);
		expect(() => item.href({ params: { id: "one" }, search: { extra: "value" } } as never)).toThrow(TypeError);
	});

	it("accepts null-prototype inputs while rejecting inherited and unexpected properties", () => {
		const item = route("/items/:id", { search: { constructor: codec.string().optional() } });
		const params = Object.assign(Object.create(null), { id: "one" });
		const search = Object.assign(Object.create(null), { constructor: "value" });
		const input = Object.assign(Object.create(null), { params, search });

		expect(item.href(input)).toBe("/items/one?constructor=value");
		expect(() => item.href({ params: Object.create({ id: "one" }) })).toThrow(TypeError);
		expect(() => item.href({ params: { id: "one", extra: "value" } as never })).toThrow(TypeError);
		expect(() => item.href({ params: [] as never })).toThrow(TypeError);
	});

	it("matches only HTTP and HTTPS URLs", () => {
		const project = route("/projects/:id");

		expect(project.match("https://example.com/projects/42")?.params.id).toBe("42");
		expect(project.match("http://example.com/projects/42")?.params.id).toBe("42");
		expect(project.match("javascript:/projects/42")).toBeNull();
		expect(project.match("file:///projects/42")).toBeNull();
	});

	it("decodes special property names as safe own data properties", () => {
		const special = route("/values/:__proto__", {
			search: { ["__proto__"]: codec.string() },
		});
		const match = special.match("/values/path?__proto__=search")!;

		expect(Object.getPrototypeOf(match.params)).toBe(Object.prototype);
		expect(Object.getPrototypeOf(match.search)).toBe(Object.prototype);
		expect(Object.hasOwn(match.params, "__proto__")).toBe(true);
		expect(Object.hasOwn(match.search, "__proto__")).toBe(true);
		expect(Object.getOwnPropertyDescriptor(match.params, "__proto__")?.value).toBe("path");
		expect(Object.getOwnPropertyDescriptor(match.search, "__proto__")?.value).toBe("search");
	});

	it("does not confuse inherited object keys with pathname codecs", () => {
		const inherited = route("/values/:constructor/:toString/:hasOwnProperty");
		const href = inherited.href({
			params: { constructor: "one", toString: "two", hasOwnProperty: "three" },
		});

		expect(href).toBe("/values/one/two/three");
		expect(inherited.match(href)?.params).toEqual({
			constructor: "one",
			toString: "two",
			hasOwnProperty: "three",
		});
	});

	it("reuses one scalar codec between pathname and search parameters", () => {
		const id = codec.integer();
		const project = route("/projects/:id", {
			params: { id },
			search: { parentId: id.optional() },
		});

		expect(project.href({ params: { id: 42 }, search: { parentId: 7 } })).toBe("/projects/42?parentId=7");
		expect(project.match("/projects/42?parentId=7")?.params).toEqual({ id: 42 });
		expect(project.match("/projects/42?parentId=7")?.search).toEqual({ parentId: 7 });
		expect(project.match("/projects/42")?.search).toEqual({ parentId: undefined });
	});

	it("supports the same enumerated codec in pathname and search parameters", () => {
		const kind = codec.enum("new", "popular");
		const browse = route("/browse/:kind", {
			params: { kind },
			search: { related: kind.optional() },
		});

		expect(browse.href({ params: { kind: "new" }, search: { related: "popular" } })).toBe(
			"/browse/new?related=popular",
		);
		expect(browse.match("/browse/new?related=popular")?.params).toEqual({ kind: "new" });
		expect(browse.match("/browse/other")).toBeNull();
		expect(browse.match("/browse/new?related=other")).toBeNull();
		expect(() => browse.href({ params: { kind: "other" as never } })).toThrow(TypeError);
		expect(() => kind.default("other" as never)).toThrow(TypeError);
		expect(() => codec.enum("duplicate", "duplicate")).toThrow(TypeError);
	});

	it("rejects optional, defaulted, repeated, and unbranded pathname codecs", () => {
		for (const invalidCodec of [
			codec.string().optional(),
			codec.string().default("fallback"),
			codec.string().many(),
			[],
		]) {
			expect(() => route("/values/:value", { params: { value: invalidCodec } } as never)).toThrow(TypeError);
		}
	});

	it("rejects repeated conversion after a codec has already been modified", () => {
		for (const modified of [codec.string().optional(), codec.string().default("fallback"), codec.string().many()]) {
			expect(() => (modified as { many(): unknown }).many()).toThrow(TypeError);
		}
	});

	it("preserves optional repeated values and clones repeated defaults", () => {
		const original = ["one", "two"];
		const listing = route("/listing", {
			search: {
				tags: codec.string().many().default(original),
				filters: codec.string().many().optional(),
			},
		});
		original.push("mutated");

		const first = listing.match("/listing")!;
		expect(first.search).toEqual({ tags: ["one", "two"], filters: undefined });
		first.search.tags.push("local");
		expect(listing.match("/listing")?.search.tags).toEqual(["one", "two"]);
		expect(listing.match("/listing?tags=three&filters=red&filters=blue")?.search).toEqual({
			tags: ["three"],
			filters: ["red", "blue"],
		});
		expect(() => codec.integer().default(1.5)).toThrow(TypeError);
		expect(() =>
			codec
				.string()
				.many()
				.default("invalid" as never),
		).toThrow(TypeError);
	});
});
