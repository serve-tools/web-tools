import { assert, loadSolution } from "../_shared.mjs";

const { buildDownloadLink } = await loadSolution();

assert.equal(buildDownloadLink({ reportId: 1, format: "csv" }), "/exports/1.csv");
assert.equal(buildDownloadLink({ reportId: 9, format: "json", columns: [] }), "/exports/9.json");
assert.equal(
	buildDownloadLink({ reportId: 7, format: "csv", columns: ["full name", "a/b", "é", "a&b", "😀"] }),
	"/exports/7.csv?columns=full+name&columns=a%2Fb&columns=%C3%A9&columns=a%26b&columns=%F0%9F%98%80",
);
assert.equal(buildDownloadLink({ reportId: 3, format: "csv", gzip: true }), "/exports/3.csv?gzip=true");
assert.equal(
	buildDownloadLink({ reportId: 4, format: "json", columns: ["z", "a"], gzip: true }),
	"/exports/4.json?columns=z&columns=a&gzip=true",
);
assert.equal(
	buildDownloadLink({ reportId: Number.MAX_SAFE_INTEGER, format: "json", gzip: false }),
	`/exports/${Number.MAX_SAFE_INTEGER}.json`,
);
assert.equal(buildDownloadLink({ reportId: 5, format: "csv", columns: undefined, gzip: undefined }), "/exports/5.csv");

const nullPrototypeInput = Object.assign(Object.create(null), { reportId: 6, format: "json" });
assert.equal(buildDownloadLink(nullPrototypeInput), "/exports/6.json");

const nonEnumerableExtra = { reportId: 6, format: "csv" };
Object.defineProperty(nonEnumerableExtra, "metadata", { value: true });
assert.equal(buildDownloadLink(nonEnumerableExtra), "/exports/6.csv");

class DownloadInput {
	reportId = 8;
	format = "json";
}
assert.equal(buildDownloadLink(new DownloadInput()), "/exports/8.json");

const getterInput = {};
Object.defineProperties(getterInput, {
	format: { enumerable: true, get: () => "csv" },
	reportId: { enumerable: true, get: () => 10 },
});
assert.equal(buildDownloadLink(getterInput), "/exports/10.csv");

for (const invalid of [
	null,
	[],
	{},
	{ reportId: 1 },
	{ format: "csv" },
	{ reportId: 0, format: "csv" },
	{ reportId: -1, format: "csv" },
	{ reportId: 1.5, format: "csv" },
	{ reportId: Number.MAX_SAFE_INTEGER + 1, format: "csv" },
	{ reportId: NaN, format: "csv" },
	{ reportId: 1, format: "xml" },
	{ reportId: 1, format: "CSV" },
	{ reportId: 1, format: "csv", columns: null },
	{ reportId: 1, format: "csv", gzip: null },
	{ reportId: 1, format: "csv", gzip: 1 },
	{ reportId: 1, format: "csv", extra: true },
	{ reportId: 1, format: "csv", columns: "a" },
	{ reportId: 1, format: "csv", columns: [""] },
	{ reportId: 1, format: "csv", columns: [1] },
	{ reportId: 1, format: "csv", columns: ["\uD800"] },
	{ reportId: 1, format: "csv", columns: ["\uDC00"] },
]) {
	assert.throws(() => buildDownloadLink(invalid), TypeError);
}

const sparseColumns = ["first"];
sparseColumns.length = 3;
sparseColumns[2] = "third";
assert.throws(() => buildDownloadLink({ reportId: 1, format: "json", columns: sparseColumns }), TypeError);

const enumerableSymbolExtra = { reportId: 1, format: "csv" };
Object.defineProperty(enumerableSymbolExtra, Symbol("extra"), { enumerable: true, value: true });
assert.throws(() => buildDownloadLink(enumerableSymbolExtra), TypeError);
