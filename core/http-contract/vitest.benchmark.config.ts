import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.benchmark.config.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const root = resolve(process.env.HTTP_CONTRACT_BENCH_ROOT ?? repoRoot);
const httpContractDist = resolve(root, "core/http-contract/dist");
const routerEntry = resolve(root, "core/router/dist/router.js");

const hash = createHash("sha256");
const httpContractEntries = readdirSync(httpContractDist, { recursive: true, withFileTypes: true })
	.filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
	.map((entry) => resolve(entry.parentPath, entry.name))
	.sort();

for (const entry of httpContractEntries) {
	hash.update(entry.slice(root.length)).update("\0").update(readFileSync(entry)).update("\0");
}

hash.update(routerEntry.slice(root.length)).update("\0").update(readFileSync(routerEntry));
console.log(`[http-contract:benchmark] subjectRoot=${root} subjectHash=${hash.digest("hex")}`);

export default mergeConfig(
	baseConfig,
	defineConfig({
		resolve: {
			alias: [
				{
					find: /^\.\.\/src\/(client|http-contract|openapi|server)\.js$/,
					replacement: `${httpContractDist}/$1.js`,
				},
				{ find: "@serve-tools/router", replacement: routerEntry },
			],
		},
		server: { fs: { allow: [repoRoot, root] } },
	}),
);
