import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const demoPackage = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
const [dependency] = Object.keys(demoPackage.dependencies);
const localPackageURL = new URL("../../package.json", import.meta.url);

if (existsSync(localPackageURL)) {
	const localPackage = JSON.parse(await readFile(localPackageURL));

	if (localPackage.name === dependency) {
		const npmPath = process.env.npm_execpath;

		if (npmPath === undefined) throw new Error("npm_execpath is unavailable");

		const result = spawnSync(process.execPath, [npmPath, "run", "build", "--workspace", dependency], {
			cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
			stdio: "inherit",
		});

		if (result.error !== undefined) throw result.error;
		if (result.status !== 0) process.exit(result.status ?? 1);
	}
}
