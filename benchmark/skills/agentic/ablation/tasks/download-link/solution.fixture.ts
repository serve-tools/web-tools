import { codec, route } from "@serve-tools/router";

const download = route("/exports/:reportId.:format", {
	params: { reportId: codec.integer(), format: codec.enum("csv", "json") },
	search: { columns: codec.string().many(), gzip: codec.enum("true", "false").default("false") },
});

export function buildDownloadLink(input: {
	reportId: number;
	format: "csv" | "json";
	columns?: string[];
	gzip?: boolean;
}) {
	if (
		!input ||
		typeof input !== "object" ||
		Array.isArray(input) ||
		!Object.hasOwn(input, "reportId") ||
		!Object.hasOwn(input, "format") ||
		Reflect.ownKeys(input)
			.filter((key) => Object.prototype.propertyIsEnumerable.call(input, key))
			.some((key) => typeof key !== "string" || !["reportId", "format", "columns", "gzip"].includes(key)) ||
		!Number.isSafeInteger(input.reportId) ||
		input.reportId <= 0 ||
		(input.format !== "csv" && input.format !== "json") ||
		(input.gzip !== undefined && typeof input.gzip !== "boolean")
	) {
		throw new TypeError("invalid input");
	}
	if (input.columns !== undefined) {
		if (!Array.isArray(input.columns)) {
			throw new TypeError("columns");
		}
		for (let index = 0; index < input.columns.length; ++index) {
			if (
				!(index in input.columns) ||
				typeof input.columns[index] !== "string" ||
				!input.columns[index] ||
				!input.columns[index].isWellFormed()
			) {
				throw new TypeError("columns");
			}
		}
	}

	return download.href({
		params: { reportId: input.reportId, format: input.format },
		search: { columns: input.columns, ...(input.gzip ? { gzip: "true" } : {}) },
	});
}
