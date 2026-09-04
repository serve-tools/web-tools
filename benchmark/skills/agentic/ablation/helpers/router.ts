import { codec, route } from "@serve-tools/router";

/** Builds a route with an optional positive page query and normalizes a missing page to one. */
export const pagedRoute = <Path extends string>(path: Path) =>
	route(path, {
		search: {
			page: codec
				.schema({
					parse: (value) => {
						const page = Number(value);
						if (!Number.isSafeInteger(page) || page < 1 || String(page) !== value) {
							throw new TypeError("page must be a positive integer");
						}
						return page;
					},
					format: (value) => {
						if (!Number.isSafeInteger(value) || value < 1) {
							throw new TypeError("page must be a positive integer");
						}

						return String(value);
					},
				})
				.default(1),
		},
	});
