import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function packRelease(root, releaseDirectory) {
	const planPath = path.join(releaseDirectory, "release-plan.json");
	const plan = JSON.parse(await readFile(planPath, "utf8"));

	for (const packageData of plan) {
		const result = JSON.parse(
			execFileSync(
				"npm",
				["pack", path.join(root, packageData.path), "--pack-destination", releaseDirectory, "--json"],
				{ encoding: "utf8" },
			),
		);
		const packed = Array.isArray(result) ? result[0] : Object.values(result)[0];
		if (!packed?.filename) {
			throw new Error(`npm pack did not return an artifact for ${packageData.name}`);
		}
		if (packed.name !== packageData.name || packed.version !== packageData.version) {
			throw new Error(
				`Packed ${packed.name}@${packed.version}, expected ${packageData.name}@${packageData.version}`,
			);
		}

		const tarball = path.join(releaseDirectory, packed.filename);
		const hash = createHash("sha256")
			.update(await readFile(tarball))
			.digest("hex");
		await writeFile(`${tarball}.sha256`, `${hash}  ${packed.filename}\n`);
		packageData.tarball = packed.filename;
	}

	await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
	return plan;
}

export async function createAttestationPlan(releaseDirectory) {
	const planPath = path.join(releaseDirectory, "release-plan.json");
	const plan = JSON.parse(await readFile(planPath, "utf8"));
	if (!Array.isArray(plan) || plan.length === 0) {
		throw new Error("Release plan has no attestation subjects");
	}

	return Promise.all(
		plan.map(async ({ name, version, tarball }) => {
			if (
				!/^@serve-tools\/[a-z0-9-]+$/.test(name) ||
				!version ||
				!/^[0-9A-Za-z.+-]+$/.test(version) ||
				!tarball ||
				path.basename(tarball) !== tarball ||
				!tarball.endsWith(".tgz")
			) {
				throw new Error("Release plan has an invalid attestation subject");
			}

			const digest = createHash("sha512")
				.update(await readFile(path.join(releaseDirectory, tarball)))
				.digest("hex");
			const purl = `pkg:npm/${name.replace("@", "%40")}@${version}`;
			return { digest: `sha512:${digest}`, purl, tarball };
		}),
	);
}

async function main() {
	const releaseDirectory = process.env.RELEASE_DIRECTORY;
	if (!releaseDirectory) {
		throw new Error("RELEASE_DIRECTORY is required");
	}

	const plan = await packRelease(process.cwd(), releaseDirectory);
	console.log(`Packed ${plan.length} release artifact${plan.length === 1 ? "" : "s"}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`::error::${error.message}`);
		process.exitCode = 1;
	});
}
