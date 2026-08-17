import { describe, expect, it } from "vitest";

import {
	acceptsContentType,
	contentType,
	isContentType,
	isStreamContentType,
	streamContentType,
} from "../src/http-stream.js";

describe("HTTP stream protocol utilities", () => {
	it("distinguishes finite messages from framed streams", () => {
		expect(isContentType(contentType)).toBe(true);
		expect(isContentType(streamContentType)).toBe(false);
		expect(isContentType("application/octet-stream")).toBe(false);

		expect(isStreamContentType(streamContentType)).toBe(true);
		expect(isStreamContentType(contentType)).toBe(false);
	});

	it("parses weighted Accept lists separately from Content-Type", () => {
		expect(acceptsContentType(`application/json, ${contentType}`)).toBe(true);
		expect(acceptsContentType(`${contentType};q=0`)).toBe(false);
		expect(acceptsContentType(`${contentType};q=0.5`)).toBe(true);
		expect(acceptsContentType(`${contentType};q=0.5;q=1`)).toBe(false);
		expect(acceptsContentType(`${contentType};charset=utf-8`)).toBe(false);
		expect(acceptsContentType(streamContentType, true)).toBe(true);
		expect(acceptsContentType(`${streamContentType};q=0`, true)).toBe(false);
		expect(acceptsContentType(`${streamContentType};charset=utf-8`, true)).toBe(false);
		expect(acceptsContentType(contentType, true)).toBe(false);
		expect(acceptsContentType(streamContentType)).toBe(false);
	});
});
