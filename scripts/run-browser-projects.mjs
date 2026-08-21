import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const shardCount = 4;

for (let shard = 0; shard < shardCount; ++shard) {
	const result = spawnSync(
		process.execPath,
		[vitest, "run", "--config", "vitest.browser.projects.config.ts", "--maxWorkers=1"],
		{
			stdio: "inherit",
			env: { ...process.env, VITEST_BROWSER_PROJECT_SHARD: `${shard}/${shardCount}` },
		},
	);

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
