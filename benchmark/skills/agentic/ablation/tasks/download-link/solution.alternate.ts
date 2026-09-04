import { codec, route } from "@serve-tools/router";

const download = route("/exports/:reportId.:format", {
	params: { reportId: codec.integer(), format: codec.enum("csv", "json") },
	search: { columns: codec.string().many(), gzip: codec.enum("true", "false").default("false") },
});

export function buildDownloadLink(input: unknown): string {
	if (!isRecord(input, ["reportId", "format", "columns", "gzip"])) {
		throw new TypeError("Expected download input");
	}
	if (!Object.hasOwn(input, "reportId") || !Object.hasOwn(input, "format")) {
		throw new TypeError("Missing download input");
	}
	const { reportId, format, columns = [], gzip = false } = input as Record<string, unknown>;
	if (
		!Number.isSafeInteger(reportId) ||
		(reportId as number) <= 0 ||
		(format !== "csv" && format !== "json") ||
		typeof gzip !== "boolean"
	) {
		throw new TypeError("Invalid download input");
	}
	if (
		!Array.isArray(columns) ||
		Object.keys(columns).length !== columns.length ||
		columns.some((column) => !validString(column))
	) {
		throw new TypeError("Invalid columns");
	}
	return download.href({
		params: { reportId: reportId as number, format },
		search: gzip ? { columns, gzip: "true" } : { columns },
	});
}

function isRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	return Reflect.ownKeys(value).every((key) => {
		const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
		return !descriptor.enumerable || (typeof key === "string" && keys.includes(key));
	});
}

function validString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && value === value.toWellFormed();
}
