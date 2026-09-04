import { codec, route } from "@serve-tools/router";

const project = route("/projects/:projectId", {
	params: { projectId: codec.integer() },
	search: {
		view: codec.enum("summary", "activity").default("summary"),
		tag: codec.string().many(),
		q: codec.string().optional(),
	},
});
const projectSettings = route("/projects/:projectId/settings", {
	params: { projectId: codec.integer() },
	search: { section: codec.enum("profile", "security").default("profile") },
});
const asset = route("/assets/:assetId.:format", {
	params: { assetId: codec.string(), format: codec.enum("png", "webp") },
});

const definitions = { project, projectSettings, asset } as const;
type Kind = keyof typeof definitions;

export function createRouteCatalog() {
	return {
		build(kind: Kind, input: never): string {
			const selected = definitions[kind];

			if (!selected) {
				throw new TypeError("Unknown route kind");
			}

			return selected.href(input);
		},
		parse(url: string | URL) {
			for (const kind of ["projectSettings", "project", "asset"] as const) {
				const match = definitions[kind].match(url);

				if (match) {
					return { kind, params: match.params, search: match.search };
				}
			}

			return null;
		},
	};
}
