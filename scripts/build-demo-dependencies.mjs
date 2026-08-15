import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryURL = new URL("../", import.meta.url);
const repositoryDirectory = fileURLToPath(repositoryURL);

/** Build a demo's local package and its workspace dependencies. */
export async function buildDemoDependencies(demoPackageURL) {
	const demoPackage = JSON.parse(await readFile(demoPackageURL));
	const localPackage = JSON.parse(await readFile(new URL("../package.json", demoPackageURL)));
	const npmPath = process.env.npm_execpath;

	if (demoPackage.dependencies[localPackage.name] === undefined) {
		throw new Error(`${demoPackage.name} must depend on its local package, ${localPackage.name}`);
	}

	if (npmPath === undefined) {
		throw new Error("npm_execpath is unavailable");
	}

	for (const script of ["build:dependencies", "build"]) {
		const result = spawnSync(
			process.execPath,
			[npmPath, "run", script, "--if-present", "--workspace", localPackage.name],
			{
				cwd: repositoryDirectory,
				stdio: "inherit",
			},
		);

		if (result.error !== undefined) {
			throw result.error;
		}

		if (result.status !== 0) {
			process.exit(result.status ?? 1);
		}
	}
}
