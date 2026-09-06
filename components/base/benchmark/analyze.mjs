import { readFile } from "node:fs/promises";

const path = process.argv[2] ?? "/private/tmp/base-mount-diagnostic.json";
const input = JSON.parse(await readFile(path, "utf8"));
if (input.pairs.length !== 5) {
	throw new Error("This frozen diagnostic requires exactly five independent pairs");
}

const ratios = input.pairs.map(({ results }) =>
	Math.log(results["validate-each"].summary.mountMedianMs / results["validate-final"].summary.mountMedianMs),
);
const mean = ratios.reduce((total, value) => total + value, 0) / ratios.length;
const variance = ratios.reduce((total, value) => total + (value - mean) ** 2, 0) / (ratios.length - 1);
const critical95 = 2.776;
const margin = critical95 * Math.sqrt(variance / ratios.length);
const interval = [Math.exp(mean - margin), Math.exp(mean + margin)];
const ratio = Math.exp(mean);
const threshold = 1.1;
const verdict =
	interval[0] > threshold
		? "validation-history sensitivity detected"
		: interval[1] < 1 / threshold
			? "deferring validation regressed repeated mount"
			: "inconclusive";

const result = {
	interval95: interval,
	pairRatios: ratios.map((value) => Math.exp(value)),
	ratioValidateEachOverValidateFinal: ratio,
	threshold,
	verdict,
};

console.log(JSON.stringify(result, null, 2));
