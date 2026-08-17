import { describe, expect, it } from "vitest";

import { contentType, isNegotiatedContentType } from "../src/http-stream.js";

describe("HTTP stream protocol utilities", () => {
	it("requires the protocol parameter during media negotiation", () => {
		expect(isNegotiatedContentType(contentType)).toBe(true);
		expect(isNegotiatedContentType(`application/json, ${contentType}`)).toBe(true);
		expect(isNegotiatedContentType("application/octet-stream")).toBe(false);
		expect(isNegotiatedContentType("text/event-stream")).toBe(false);
	});
});
