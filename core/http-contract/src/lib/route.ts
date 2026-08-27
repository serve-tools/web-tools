import type { AnyRoute } from "@serve-tools/router";
import type { SerializationMode } from "./types.js";

/** Tests a known native pathname domain; href and unknown codecs may accept any wire value. */
export function acceptsNativePathValue(
	entry: { readonly route: AnyRoute; readonly serialization?: SerializationMode | undefined },
	parameter: string,
	wire: string,
	source: "client" | "request",
): boolean {
	if (entry.serialization === "href") {
		return true;
	}
	const metadata = entry.route.options.params?.[parameter.slice(1)]?.metadata;
	if (metadata?.native !== true) {
		return true;
	}

	let value = wire;
	if (source === "request") {
		try {
			value = decodeURIComponent(wire);
		} catch {
			return false;
		}
	}
	if (metadata.type === "integer") {
		const number = Number(value);
		return (
			Number.isSafeInteger(number) &&
			(source === "request" ? /^-?(?:0|[1-9]\d*)$/.test(value) : String(number) === wire)
		);
	}
	if (metadata.type === "enum" && Array.isArray(metadata.values)) {
		return metadata.values.some(
			(candidate: unknown) =>
				typeof candidate !== "string" ||
				!candidate.isWellFormed() ||
				(source === "request" ? candidate === value : encodeURIComponent(candidate) === wire),
		);
	}
	return true;
}
