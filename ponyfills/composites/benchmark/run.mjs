import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const runner = resolve(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const defaultEntry = resolve(packageRoot, "dist/ponyfill-composites.js");
const entry = process.env.COMPOSITES_BENCH_ENTRY
	? resolve(process.cwd(), process.env.COMPOSITES_BENCH_ENTRY)
	: defaultEntry;
const arguments_ = process.argv.slice(2);
const workloadIndex = arguments_.indexOf("--workload");
const workload = workloadIndex < 0 ? undefined : arguments_[workloadIndex + 1];

if (workloadIndex >= 0 && !workload) {
	throw new TypeError("Expected a workload name after --workload.");
}

if (workloadIndex >= 0) {
	arguments_.splice(workloadIndex, 2, "--testNamePattern", `^${workload}$`);
}

const entryDirectory = dirname(entry);
const siblingJavaScript = readdirSync(entryDirectory)
	.filter((name) => name.endsWith(".js"))
	.sort();
const siblingJavaScriptHash = createHash("sha256");

for (const name of siblingJavaScript) {
	siblingJavaScriptHash.update(name);
	siblingJavaScriptHash.update("\0");
	siblingJavaScriptHash.update(readFileSync(resolve(entryDirectory, name)));
	siblingJavaScriptHash.update("\0");
}

process.stdout.write(
	`[benchmark-subject] ${JSON.stringify({
		entry,
		entrySha256: createHash("sha256").update(readFileSync(entry)).digest("hex"),
		siblingJavaScriptSha256: siblingJavaScriptHash.digest("hex"),
	})}\n`,
);

const result = spawnSync(process.execPath, [runner, "run", "--config", "benchmark/vitest.config.ts", ...arguments_], {
	cwd: packageRoot,
	env: { ...process.env, COMPOSITES_BENCH_ENTRY: entry },
	stdio: "inherit",
});

if (result.error) {
	throw result.error;
}

process.exitCode = result.status ?? 1;
