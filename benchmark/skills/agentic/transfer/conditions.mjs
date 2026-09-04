import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConditions } from "../conditions.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));

/** Build a package-driven candidate without consulting evaluation task metadata. */
export async function createTransferConditions(root) {
	const baseline = await createConditions(root);
	const manifest = JSON.parse(await readFile(path.join(directory, "recipes/manifest.json"), "utf8"));
	assert.ok(Array.isArray(manifest) && manifest.length > 0, "Recipe manifest must be a nonempty array.");
	const scaffolds = {};
	const index = [
		"# Reusable consumer recipes",
		"",
		"Choose by capability, copy the .ts file, then adapt its integration.",
		"",
	];
	for (const recipe of manifest) {
		assert.ok(typeof recipe.file === "string" && !recipe.file.includes("..") && !path.isAbsolute(recipe.file));
		const virtual = `recipes/${recipe.file}`;
		scaffolds[virtual] = await readFile(path.join(directory, "recipes", recipe.file), "utf8");
		index.push(
			`- ${recipe.title}: ${recipe.description ?? recipe.whenToUse ?? ""} (${recipe.packages.join(", ")}). Copy ${virtual}.`,
		);
	}
	const skill = [
		"---",
		"name: reusable-consumer-recipes",
		"description: Copy and adapt tested public-package helpers when implementing consumer integrations.",
		"---",
		"",
		"1. Read recipes/INDEX.md and choose the capability needed for the requested task.",
		"2. Read the chosen recipe and use copy_file to make it solution.ts before authoring code.",
		"3. Preserve useful helpers. Replace the final adapter marker with the requested exports using replace_solution; change helpers only where the task requires it.",
		"4. Read the package README or public declarations when adaptation requires details. Validate all requested input and ownership behavior, including invalid values and failure paths.",
		"5. Run public checks and repair the artifact. A copied recipe alone is not a completed task.",
	].join("\n");
	const minimal = {
		id: "minimal",
		discovery: `${baseline.docs.discovery}\n\nFollow skills/reusable-consumer-recipes/SKILL.md. This treatment is a copy-and-adapt workflow: first copy a relevant .ts recipe, then implement the requested adapter. Recipes are indexed at recipes/INDEX.md.`,
		files: {
			...baseline.docs.files,
			"recipes/INDEX.md": index.join("\n"),
			"skills/reusable-consumer-recipes/SKILL.md": skill,
		},
		scaffolds,
		recipeManifest: manifest,
		requireRecipeCopy: true,
		excludedPackages: baseline.docs.excludedPackages,
	};
	minimal.sha256 = createHash("sha256").update(JSON.stringify(minimal)).digest("hex");
	return { docs: baseline.docs, current: baseline.current, minimal: Object.freeze(minimal) };
}
