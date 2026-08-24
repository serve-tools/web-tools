import { describe, expect, it } from "vitest";
import * as ponyfill from "../src/ponyfill-urlpattern.js";

describe("URLPattern ponyfill exports", () => {
	it("exports URLPattern as its only runtime API", () => {
		expect(Object.keys(ponyfill)).toEqual(["URLPattern"]);
	});

	it("exports a working URLPattern constructor", () => {
		const pattern = new ponyfill.URLPattern({ pathname: "/users/:id" });

		expect(pattern.exec("https://example.com/users/42")?.pathname.groups).toEqual({ id: "42" });
	});
});
