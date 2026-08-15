import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../lib/catalog.mjs";
import { compileFiles, gradeResult } from "../lib/grader.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = await loadCatalog(root);

test("selection grading rejects attractive adjacent packages", async () => {
	const grade = await gradeResult({
		catalog,
		compile: false,
		route: {
			documents: ["client-signals/storage/README.md"],
			packages: ["@serve-tools/signal-storage"],
		},
		solution: { answer: "", files: [] },
		task: {
			expected: { packages: ["@serve-tools/client-storage"] },
			kind: "selection",
		},
		variant: "baseline",
	});

	assert.equal(grade.pass, false);
	assert.equal(grade.score, 0);
});

test("Skill document grading distinguishes same-named recipes from different packages", async () => {
	const grade = await gradeResult({
		catalog,
		compile: false,
		route: {
			documents: [
				"client/storage/skills/serve-tools-client-storage/SKILL.md",
				"client-signals/storage/skills/serve-tools-signal-storage/references/recipe-quick-start.md",
			],
			packages: ["@serve-tools/client-storage"],
		},
		solution: {
			answer: "",
			files: [{ content: 'import "@serve-tools/client-storage";\n', path: "answer.ts" }],
		},
		task: {
			expected: {
				codeTerms: [],
				documentSuffixes: ["client/storage/skills/serve-tools-client-storage/references/recipe-quick-start.md"],
				packages: ["@serve-tools/client-storage"],
			},
			kind: "usage",
		},
		variant: "skill",
	});

	assert.equal(grade.checks.documents, 0);
});

test("compiler accepts safe self-contained TypeScript", async () => {
	const result = await compileFiles(root, [
		{ content: "const answer: number = 42;\nvoid answer;\n", path: "answer.ts" },
	]);

	assert.equal(result.passed, true, result.stderr);
});

test("generated files cannot escape the temporary project", async () => {
	await assert.rejects(
		gradeResult({
			catalog,
			compile: false,
			route: { documents: [], packages: ["@serve-tools/client-websocket"] },
			solution: { answer: "", files: [{ content: "", path: "../../outside.ts" }] },
			task: {
				expected: { codeTerms: [], packages: ["@serve-tools/client-websocket"] },
				kind: "usage",
			},
			variant: "baseline",
		}),
		/Unsafe generated file/,
	);
});
