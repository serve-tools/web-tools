import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const shardCount = 4;
const concurrency = 2;
let nextShard = 0;
let exitCode = 0;

await Promise.all(
	Array.from({ length: concurrency }, async () => {
		while (nextShard < shardCount && exitCode === 0) {
			const shard = nextShard++;
			const status = await runShard(shard);

			if (status !== 0 && exitCode === 0) {
				exitCode = status;
			}
		}
	}),
);

if (exitCode !== 0) {
	process.exitCode = exitCode;
}

function runShard(shard) {
	return new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[vitest, "run", "--config", "vitest.browser.projects.config.ts", "--maxWorkers=1"],
			{
				stdio: "inherit",
				env: { ...process.env, VITEST_BROWSER_PROJECT_SHARD: `${shard}/${shardCount}` },
			},
		);

		child.once("error", reject);
		child.once("exit", (status) => resolve(status ?? 1));
	});
}
