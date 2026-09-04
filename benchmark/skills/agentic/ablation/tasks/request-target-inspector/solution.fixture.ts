import { codec, route } from "@serve-tools/router";

const releases = route("/releases/:channel", {
	params: { channel: codec.enum("stable", "beta") },
	search: { page: codec.integer().optional(), label: codec.string().many() },
});
export function inspectRequestTarget(input: unknown) {
	if (!(typeof input === "string" || input instanceof URL)) {
		return null;
	}
	try {
		const url = input instanceof URL ? input : new URL(input, "http://local.test");
		if (
			!/^https?:$/.test(url.protocol) ||
			/%(?![\dA-Fa-f]{2})/.test(url.pathname + url.search) ||
			url.searchParams.getAll("page").includes("-0")
		) {
			return null;
		}
		const match = releases.match(url);
		return match
			? { channel: match.params.channel, page: match.search.page, labels: [...match.search.label] }
			: null;
	} catch {
		return null;
	}
}
