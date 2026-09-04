import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConditions } from "../conditions.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const guidance = `---
name: focused-consumer-guide
description: Implement a consumer integration using public package contracts and optional reusable code.
---

1. Identify the requested capability using index/packages.md; read the relevant README and declarations.
2. Use list_files to discover optional recipes. Read or copy a helper only if it fits; writing the solution directly is equally valid. Remove unused code.
3. Implement the stated exported API. Preserve validation, error delivery, cancellation, ownership, and cleanup requirements. Do not add restrictions absent from the task.
4. Run check, repair failures within the budget, and finish with solution.ts.
`;

/** Only the helper files and their index distinguish the two short-guide conditions. */
export async function createAblationConditions(root) {
	const baseline = await createConditions(root);
	const common = {
		discovery: `${baseline.docs.discovery}\nUse guide/SKILL.md for a short implementation workflow.`,
		files: { ...baseline.docs.files, "guide/SKILL.md": guidance },
		scaffolds: {},
		excludedPackages: baseline.docs.excludedPackages,
	};
	const minimal = condition({ ...common, id: "minimal" });
	const manifest = JSON.parse(await readFile(path.join(directory, "helpers/manifest.json"), "utf8"));
	assert.equal(manifest.length, 12);
	const scaffolds = {};
	for (const helper of manifest) {
		assert.ok(!helper.file.includes("..") && !path.isAbsolute(helper.file));
		scaffolds[`recipes/${helper.file}`] = await readFile(path.join(directory, "helpers", helper.file), "utf8");
	}
	const index = [
		"# Optional focused helpers",
		"Read or reuse only when the helper fits. Copying is optional.",
		...manifest.map(
			(helper) =>
				`- recipes/${helper.file}: ${helper.title}. ${helper.whenToUse} (${helper.packages.join(", ")}).`,
		),
	].join("\n");
	const helpers = condition({
		...common,
		id: "helpers",
		files: { ...common.files, "recipes/INDEX.md": index },
		scaffolds,
		recipeManifest: manifest,
	});
	return { docs: baseline.docs, current: baseline.current, minimal, helpers };
}

function condition(value) {
	return Object.freeze({ ...value, sha256: createHash("sha256").update(JSON.stringify(value)).digest("hex") });
}
