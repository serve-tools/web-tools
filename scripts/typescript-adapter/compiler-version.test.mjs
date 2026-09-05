import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compilerRange, supportsCompilerVersion } from "../../rolldown/typescript/src/internal/compiler-version.mjs";
import { loadSemver } from "../release-plan.mjs";

test("compiler acceptance matches the peer range for stable 7.1 and 7.1.0 pre-releases", async () => {
	const manifest = JSON.parse(await readFile(new URL("../../rolldown/typescript/package.json", import.meta.url)));
	assert.equal(manifest.peerDependencies.typescript, compilerRange);
	const { satisfies } = loadSemver();
	const accepted = [
		"7.1.0",
		"7.1.1",
		"7.1.25",
		"7.1.999",
		"7.1.3+build.42",
		"7.1.0-0",
		"7.1.0-dev.20260904.1",
		"7.1.0-beta.1+build.42",
		"7.1.0-0A.1",
	];
	const rejected = [
		"7.0.9",
		"7.2.0",
		"8.0.0",
		"5.9.3",
		"7.1.1-rc.1",
		"7.1.25-dev.1",
		"7.1.0-01",
		"7.1.0-alpha.01",
		"7.1.0-alpha..1",
		"7.1.0-alpha_1",
		"7.1",
		"7.1.01",
		"7.1.0+",
		"7.1.0+bad_",
		"",
	];
	for (const version of [...accepted, ...rejected]) {
		assert.equal(supportsCompilerVersion(version), satisfies(version, compilerRange), version);
		assert.equal(supportsCompilerVersion(version), accepted.includes(version), version);
	}
});
