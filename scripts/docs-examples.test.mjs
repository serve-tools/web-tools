import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	checkDocumentationExamples,
	extractCodeExamples,
	findCompanionExamples,
	selectIntroductoryExample,
	selectIntroductoryExamples,
} from "./docs-examples.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

test("intro extraction skips CDN imports and retains source line numbers", () => {
	const markdown =
		'# Tool\n\n```js\nimport * as tool from "https://esm.run/tool";\n```\n\n```ts\nconst count = 1;\n```\n';
	assert.equal(extractCodeExamples(markdown).length, 2);
	assert.deepEqual(selectIntroductoryExample(markdown), { language: "ts", code: "const count = 1;\n", line: 8 });
});

test("companion extraction uses a real uniquely exported schema fence", () => {
	const markdown =
		'```ts\nimport type { Schema } from "./worker.js";\n```\n\n```ts\nexport type Schema = { name: string };\n```\n';
	assert.deepEqual(findCompanionExamples(markdown, selectIntroductoryExample(markdown)), [
		{
			language: "ts",
			code: "export type Schema = { name: string };\n",
			line: 6,
			filename: "worker.ts",
		},
	]);
	assert.deepEqual(
		findCompanionExamples(
			markdown + "\n```ts\nexport type Schema = number;\n```\n",
			selectIntroductoryExample(markdown),
		),
		[],
	);
});

test("checking keeps README globals isolated and rejects malformed JavaScript", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "docs-examples-test-"));
	try {
		await symlink(path.join(repositoryRoot, "node_modules"), path.join(root, "node_modules"), "dir");
		await writeFile(
			path.join(root, "package.json"),
			JSON.stringify({ type: "module", workspaces: ["one", "two", "three", "components/base", "hidden"] }),
		);
		const snippets = [
			"```ts\ndeclare global { var documentedHost: HTMLElement; }\nexport {};\n```\n",
			'```ts\ndocumentedHost.textContent = "Missing setup";\n```\n',
			"```js\nconst = ;\n```\n",
		];
		for (const [index, location] of ["one", "two", "three"].entries()) {
			await mkdir(path.join(root, location));
			await writeFile(path.join(root, location, "package.json"), JSON.stringify({ name: `example-${location}` }));
			await writeFile(path.join(root, location, "README.md"), snippets[index]);
		}
		for (const location of ["components/base", "hidden"]) {
			await mkdir(path.join(root, location), { recursive: true });
			await writeFile(
				path.join(root, location, "package.json"),
				JSON.stringify({ name: `private-${location.replace("/", "-")}`, private: true }),
			);
			await writeFile(path.join(root, location, "README.md"), "```ts\nconst count = 1;\n```\n");
		}
		const report = await checkDocumentationExamples({ root });
		assert.equal(report.checked.length, 4);
		assert.ok(report.checked.some(({ readme }) => readme === "components/base/README.md"));
		assert.ok(!report.checked.some(({ readme }) => readme === "hidden/README.md"));
		assert.equal(report.passed, false);
		assert.match(report.diagnostics, /Cannot find name 'documentedHost'/);
		assert.match(report.diagnostics, /three\/README.md/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("intro section includes paired modules but stops before reference examples", () => {
	const markdown =
		"# Tool\n\n```ts\nexport type Schema = string;\n```\n\n```ts\nconst value = 1;\n```\n\n## Install\n\n```ts\nunknownReference();\n```\n";
	assert.equal(selectIntroductoryExamples(markdown).length, 2);
});
