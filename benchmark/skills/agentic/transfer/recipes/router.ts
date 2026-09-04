import "@serve-tools/polyfill-urlpattern";
import type { AnyRoute, RouteMatch } from "@serve-tools/router";
import { codec, route } from "@serve-tools/router";

/** A custom scalar codec that rejects unsafe integers, non-canonical wire forms, and negative zero. */
export const canonicalSafeInteger = codec.schema<number>({
	parse(value) {
		if (!/^(?:0|-[1-9]\d*|[1-9]\d*)$/.test(value)) {
			throw new TypeError("Expected a canonical integer");
		}

		const number = Number(value);

		if (!Number.isSafeInteger(number) || Object.is(number, -0)) {
			throw new TypeError("Expected a safe integer other than negative zero");
		}

		return number;
	},
	format(value) {
		if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
			throw new TypeError("Expected a safe integer other than negative zero");
		}

		return String(value);
	},
});

/** Creates an obvious-to-adapt reversible route; edit the literal path at this declaration boundary. */
export const createResourceRoute = () =>
	route("/resources/:id", {
		params: { id: canonicalSafeInteger },
		search: {
			view: codec.enum("summary", "detail").default("summary"),
			tag: codec.string().many(),
			cursor: codec.string().optional(),
		},
	});

/** Matches an ordered route table and retains the route-specific discriminated result union. */
export const matchFirstRoute = <const Routes extends readonly AnyRoute[]>(
	routes: Routes,
	url: string | URL,
): RouteMatch<Routes[number]> | null => {
	for (const candidate of routes) {
		const match = candidate.match(url);

		if (match) {
			return match as RouteMatch<Routes[number]>;
		}
	}

	return null;
};

// Add your task adapter below.
