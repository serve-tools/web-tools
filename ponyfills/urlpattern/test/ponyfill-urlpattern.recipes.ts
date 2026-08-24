import { URLPattern } from "../src/ponyfill-urlpattern.js";

/** A compile-tested recipe for matching a named URL pathname group. */
export function matchUserIdentifier(url: string): string | undefined {
	return new URLPattern({ pathname: "/users/:id" }).exec(url)?.pathname.groups.id;
}
