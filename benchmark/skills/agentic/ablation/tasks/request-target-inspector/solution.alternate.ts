import { codec, route } from "@serve-tools/router";

const releases = route("/releases/:channel", {
	params: { channel: codec.enum("stable", "beta") },
	search: { page: codec.integer().optional(), label: codec.string().many() },
});

export function inspectRequestTarget(
	input: unknown,
): { channel: "stable" | "beta"; page: number | undefined; labels: string[] } | null {
	if (!(input instanceof URL) && typeof input !== "string") {
		return null;
	}
	try {
		const url = input instanceof URL ? input : new URL(input, "https://request.invalid/");
		if (!/^https?:$/.test(url.protocol)) {
			return null;
		}
		if (/%(?![0-9A-Fa-f]{2})/.test(url.href)) {
			return null;
		}
		const match = releases.match(url);
		if (match === null) {
			return null;
		}
		const rawPage = url.searchParams.get("page");
		if (rawPage !== null && String(match.search.page) !== rawPage) {
			return null;
		}
		return { channel: match.params.channel, page: match.search.page, labels: [...match.search.label] };
	} catch {
		return null;
	}
}
