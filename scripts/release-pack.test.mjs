import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAttestationPlan, packRelease } from "./release-pack.mjs";

test("packRelease records dependency-ordered tarballs and checksums", async (context) => {
	const root = await mkdtemp(path.join(os.tmpdir(), "serve-tools-release-pack-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const originalCache = process.env.npm_config_cache;
	process.env.npm_config_cache = path.join(root, "npm-cache");
	context.after(() => {
		if (originalCache) {
			process.env.npm_config_cache = originalCache;
		} else {
			delete process.env.npm_config_cache;
		}
	});

	const packagePath = path.join(root, "package");
	const releaseDirectory = path.join(root, "release");
	await mkdir(packagePath);
	await mkdir(releaseDirectory);
	await writeFile(
		path.join(packagePath, "package.json"),
		`${JSON.stringify({ name: "@serve-tools/release-fixture", version: "1.2.3", files: ["index.js"] }, null, 2)}\n`,
	);
	await writeFile(path.join(packagePath, "index.js"), "export const fixture = true;\n");
	await writeFile(
		path.join(releaseDirectory, "release-plan.json"),
		`${JSON.stringify([{ name: "@serve-tools/release-fixture", version: "1.2.3", path: "package" }], null, 2)}\n`,
	);

	const plan = await packRelease(root, releaseDirectory);
	assert.equal(plan[0].tarball, "serve-tools-release-fixture-1.2.3.tgz");

	const tarball = await readFile(path.join(releaseDirectory, plan[0].tarball));
	const checksum = await readFile(path.join(releaseDirectory, `${plan[0].tarball}.sha256`), "utf8");
	assert.equal(checksum, `${createHash("sha256").update(tarball).digest("hex")}  ${plan[0].tarball}\n`);
	assert.deepEqual(JSON.parse(await readFile(path.join(releaseDirectory, "release-plan.json"), "utf8")), plan);
	assert.deepEqual(await createAttestationPlan(releaseDirectory), [
		{
			digest: `sha512:${createHash("sha512").update(tarball).digest("hex")}`,
			purl: "pkg:npm/%40serve-tools/release-fixture@1.2.3",
			tarball: plan[0].tarball,
		},
	]);

	await writeFile(path.join(releaseDirectory, "release-plan.json"), "[]\n");
	await assert.rejects(createAttestationPlan(releaseDirectory), /no attestation subjects/);
	await writeFile(
		path.join(releaseDirectory, "release-plan.json"),
		`${JSON.stringify([{ name: "@serve-tools/unsafe", version: "1.2.3", tarball: "../unsafe.tgz" }])}\n`,
	);
	await assert.rejects(createAttestationPlan(releaseDirectory), /invalid attestation subject/);
});
