import { URLPattern } from "../src/exports/URLPattern.js";

const pattern = new URLPattern({ pathname: "/books/:id" });

/** Matches a book URL after installing the native-aware global constructor. */
export function matchBook(input: string): string | undefined {
	const result = pattern.exec(input);

	return result?.pathname.groups.id;
}

/** Whether the exported constructor is the globally installed constructor. */
export const installed = globalThis.URLPattern === URLPattern;
