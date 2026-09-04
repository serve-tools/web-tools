import { appendFile } from "node:fs/promises";
import { createAttestationPlan } from "./release-pack.mjs";

async function main() {
	const releaseDirectory = process.env.RELEASE_DIRECTORY;
	if (!releaseDirectory) {
		throw new Error("RELEASE_DIRECTORY is required");
	}

	const include = await createAttestationPlan(releaseDirectory);
	const matrix = JSON.stringify({ include });
	if (process.env.GITHUB_OUTPUT) {
		await appendFile(process.env.GITHUB_OUTPUT, `matrix=${matrix}\n`);
	}
	console.log(matrix);
}

main().catch((error) => {
	console.error(`::error::${error.message}`);
	process.exitCode = 1;
});
