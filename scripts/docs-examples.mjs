import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspaceInventory } from "./workspaces.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

/** Extract authored JavaScript and TypeScript fences with their README line numbers. */
export function extractCodeExamples(markdown) {
	const examples = [];
	const pattern = /^```(ts|typescript|js|javascript)(?:[^\n]*)\n([\s\S]*?)^```\s*$/gm;
	for (const match of markdown.matchAll(pattern)) {
		examples.push({
			language: /^(ts|typescript)$/.test(match[1]) ? "ts" : "js",
			code: match[2],
			line: markdown.slice(0, match.index).split("\n").length + 1,
		});
	}
	return examples;
}

/** Select the first local-module example, leaving URL imports to their browser/CDN environment. */
export function selectIntroductoryExample(markdown) {
	return extractCodeExamples(markdown).find(({ code }) => !/\bfrom\s*["']https?:|\bimport\s*["']https?:/.test(code));
}

/** Include every local code fence in the introductory section, including paired worker/page files. */
export function selectIntroductoryExamples(markdown) {
	const first = selectIntroductoryExample(markdown);
	if (!first) {
		return [];
	}
	const lines = markdown.split("\n");
	let end = lines.length + 1;
	for (let index = first.line; index < lines.length; ++index) {
		if (/^## /.test(lines[index])) {
			end = index + 1;
			break;
		}
	}
	return extractCodeExamples(markdown).filter(
		({ code, line }) =>
			line >= first.line && line < end && !/\bfrom\s*["']https?:|\bimport\s*["']https?:/.test(code),
	);
}

/** Find explicitly imported companion modules among the README's authored fences. */
export function findCompanionExamples(markdown, example) {
	const introductory = selectIntroductoryExamples(markdown);
	const blocks = introductory.length ? introductory : extractCodeExamples(markdown);
	const companions = [];
	const imports = /import\s+(?:type\s+)?\{\s*(\w+)\s*\}\s+from\s*["'](\.\/[^"']+\.js)["']/g;
	for (const match of example.code.matchAll(imports)) {
		const [, name, specifier] = match;
		const declarations = blocks.filter(({ code }) =>
			new RegExp(`export\\s+(?:type|interface|class|const|function)\\s+${name}\\b`).test(code),
		);
		if (declarations.length !== 1) {
			continue;
		}
		const filename = specifier.slice(2).replace(/\.js$/, ".ts");
		if (filename.includes("..") || path.isAbsolute(filename)) {
			continue;
		}
		companions.push({ ...declarations[0], filename });
	}
	return companions;
}

/** Check actual introductory fences against built package exports without invented application globals. */
export async function checkDocumentationExamples({ root = repositoryRoot } = {}) {
	const { workspaces } = await readWorkspaceInventory(root);
	const documentedWorkspaces = workspaces.filter(
		({ manifest, location }) => !manifest.private || location === "components/base",
	);
	await mkdir(path.join(root, "dist"), { recursive: true });
	const temporaryRoot = await mkdtemp(path.join(root, "dist/docs-examples-"));
	const examples = [];
	const omitted = [];

	try {
		for (const workspace of documentedWorkspaces) {
			const readme = path.join(workspace.root, "README.md");
			const markdown = await readFile(readme, "utf8");
			const introductoryExamples = selectIntroductoryExamples(markdown);
			if (!introductoryExamples.length) {
				omitted.push({ package: workspace.name, reason: "No local JavaScript or TypeScript example" });
				continue;
			}
			for (const example of introductoryExamples) {
				const directory = String(examples.length).padStart(3, "0");
				await mkdir(path.join(temporaryRoot, directory));
				const namedFile = example.code.match(/^\/\/ ([\w./-]+\.(?:ts|js))\b/)?.[1];
				const sourceFile =
					namedFile && !namedFile.split("/").includes("..") ? namedFile : `intro.${example.language}`;
				const filename = `${directory}/${sourceFile}`;
				await mkdir(path.dirname(path.join(temporaryRoot, filename)), { recursive: true });
				await writeFile(path.join(temporaryRoot, filename), example.code);
				for (const block of introductoryExamples) {
					const blockName = block.code.match(/^\/\/ ([\w./-]+\.(?:ts|js))\b/)?.[1];
					if (!blockName || blockName.split("/").includes("..") || blockName === sourceFile) {
						continue;
					}
					const blockPath = path.join(temporaryRoot, directory, blockName);
					await mkdir(path.dirname(blockPath), { recursive: true });
					await writeFile(blockPath, block.code);
				}
				for (const companion of findCompanionExamples(markdown, example)) {
					const companionPath = path.join(temporaryRoot, directory, companion.filename);
					await mkdir(path.dirname(companionPath), { recursive: true });
					await writeFile(companionPath, companion.code);
				}
				examples.push({ package: workspace.name, readme: path.relative(root, readme), ...example, filename });
			}
		}

		const diagnostics = [];
		let passed = true;
		for (const example of examples) {
			const directory = path.join(temporaryRoot, example.filename.split("/")[0]);
			const nodeEnvironment =
				/^(server|rolldown|vite)\//.test(example.readme) || example.code.includes("/runtime/node");
			await writeFile(
				path.join(directory, "tsconfig.json"),
				JSON.stringify(
					{
						compilerOptions: {
							allowJs: true,
							checkJs: false,
							noEmit: true,
							strict: true,
							exactOptionalPropertyTypes: true,
							module: "esnext",
							moduleResolution: "bundler",
							moduleDetection: "force",
							target: "es2025",
							lib: [
								"ES2025",
								"ESNext.Disposable",
								"ESNext.Decorators",
								...(nodeEnvironment ? [] : ["DOM", "DOM.Iterable"]),
							],
							types: nodeEnvironment ? ["node"] : [],
							skipLibCheck: true,
						},
						files: [example.filename.split("/").slice(1).join("/")],
					},
					null,
					"\t",
				),
			);

			const compiler = spawnSync(
				process.execPath,
				[
					path.join(root, "node_modules/typescript/bin/tsc"),
					"--project",
					path.join(directory, "tsconfig.json"),
					"--pretty",
					"false",
				],
				{
					cwd: root,
					encoding: "utf8",
					maxBuffer: 16 * 1024 * 1024,
				},
			);
			if (compiler.error) {
				throw compiler.error;
			}
			passed &&= compiler.status === 0;
			const output = `${compiler.stdout}${compiler.stderr}`.trim();
			if (output) {
				diagnostics.push(
					output.replaceAll(
						path.relative(root, directory),
						`${example.readme} [intro at line ${example.line}]`,
					),
				);
			}
		}
		return {
			checked: examples.map(({ code: _code, filename: _filename, ...example }) => example),
			omitted,
			diagnostics: diagnostics.join("\n"),
			passed,
		};
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const report = await checkDocumentationExamples();
	console.log(
		`Checked ${report.checked.length} introductory examples against built exports (TypeScript types; JavaScript syntax).`,
	);
	for (const entry of report.omitted) {
		console.log(`Omitted ${entry.package}: ${entry.reason}.`);
	}
	if (report.diagnostics) {
		console.error(report.diagnostics);
	}
	if (!report.passed) {
		process.exitCode = 1;
	}
}
