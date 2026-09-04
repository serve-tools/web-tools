import { assert, loadSolution } from "../_shared.mjs";

const { buildDownloadLink } = await loadSolution();

assert.equal(
	buildDownloadLink({ reportId: 2, format: "csv", columns: ["a", "b"] }),
	"/exports/2.csv?columns=a&columns=b",
);
