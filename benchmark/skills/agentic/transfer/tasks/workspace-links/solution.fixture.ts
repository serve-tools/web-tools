import { codec, route } from "@serve-tools/router";

const positiveInteger = codec.schema<number>({
	parse(value) {
		const integer = Number(value);

		if (!Number.isSafeInteger(integer) || integer <= 0 || String(integer) !== value) {
			throw new TypeError("Expected a positive canonical integer");
		}

		return integer;
	},
	format(value) {
		if (!Number.isSafeInteger(value) || value <= 0) {
			throw new TypeError("Expected a positive safe integer");
		}

		return String(value);
	},
});

const board = route("/teams/:teamId/boards/:boardId", {
	params: { teamId: positiveInteger, boardId: positiveInteger },
	search: {
		mode: codec.enum("cards", "table").default("cards"),
		lane: codec.string().many(),
		focus: positiveInteger.optional(),
	},
});
const invite = route("/teams/:teamId/invite/:token", {
	params: { teamId: positiveInteger, token: codec.string() },
	search: { role: codec.enum("viewer", "editor").default("viewer") },
});

const definitions = { board, invite } as const;
type Kind = keyof typeof definitions;

export function createWorkspaceLinks() {
	return {
		build(kind: Kind, input: never): string {
			const selected = definitions[kind];

			if (!selected) {
				throw new TypeError("Unknown route kind");
			}

			return selected.href(withoutDefaults(kind, input) as never);
		},
		inspect(url: string | URL) {
			for (const kind of ["invite", "board"] as const) {
				const selected = definitions[kind];
				const match = selected.match(url);

				if (match) {
					const input = withoutDefaults(kind, { params: match.params, search: match.search }) as never;

					return { kind, params: match.params, search: match.search, canonicalHref: selected.href(input) };
				}
			}

			return null;
		},
	};
}

function withoutDefaults(kind: Kind, input: unknown): unknown {
	if (typeof input !== "object" || input === null) {
		return input;
	}

	const value = input as { readonly params?: unknown; readonly search?: Record<string, unknown> };
	const search = value.search;

	if (typeof search !== "object" || search === null) {
		return input;
	}

	const normalized = { ...search };

	if (kind === "board" && normalized.mode === "cards") {
		delete normalized.mode;
	}
	if (kind === "invite" && normalized.role === "viewer") {
		delete normalized.role;
	}

	return { ...value, search: normalized };
}
