import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function gradeResult({ catalog, compile, route, solution, task, variant }) {
	const packageScore = sameSet(route.packages, task.expected.packages) ? 1 : 0;
	const documentScore = gradeDocuments(catalog, route.documents, task, variant);

	if (task.kind === "selection") {
		return {
			checks: { documents: documentScore, packages: packageScore },
			pass: packageScore === 1,
			score: packageScore,
		};
	}

	const answerScore = containsTerms(solution.answer, task.expected.answerTerms ?? []) ? 1 : 0;

	if (task.kind === "composition") {
		const score = packageScore * 0.5 + documentScore * 0.2 + answerScore * 0.3;

		return {
			checks: { answer: answerScore, documents: documentScore, packages: packageScore },
			pass: score === 1,
			score,
		};
	}

	const files = validateGeneratedFiles(solution.files);
	const combinedSource = files.map((file) => file.content).join("\n");
	const codeScore = containsTerms(combinedSource, task.expected.codeTerms) ? 1 : 0;
	const importScore = gradeImports(combinedSource, task.expected.packages, task.expected.allowedImports);
	const compilation = compile ? await compileFiles(catalog.root, files) : { passed: true, skipped: true, stderr: "" };
	const compileScore = compilation.passed ? 1 : 0;
	const score =
		packageScore * 0.35 + documentScore * 0.15 + codeScore * 0.25 + importScore * 0.1 + compileScore * 0.15;

	return {
		checks: {
			code: codeScore,
			compile: compileScore,
			documents: documentScore,
			imports: importScore,
			packages: packageScore,
		},
		compilation,
		pass: score === 1,
		score,
	};
}

export async function compileFiles(root, files) {
	if (files.length === 0) {
		return { passed: false, skipped: false, stderr: "No TypeScript files were returned." };
	}

	const benchmarkRoot = path.join(root, "benchmark", "skills");
	await mkdir(benchmarkRoot, { recursive: true });
	const temporaryRoot = await mkdtemp(path.join(benchmarkRoot, ".tmp-"));

	try {
		for (const file of files) {
			const target = path.join(temporaryRoot, file.path);
			await mkdir(path.dirname(target), { recursive: true });
			await writeFile(target, file.content);
		}

		await writeFile(
			path.join(temporaryRoot, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					experimentalDecorators: true,
					lib: ["ESNext", "DOM", "DOM.Iterable", "WebWorker"],
					module: "Preserve",
					moduleResolution: "Bundler",
					noEmit: true,
					skipLibCheck: true,
					strict: true,
					target: "ESNext",
				},
				files: files.map((file) => `./${file.path}`),
			}),
		);

		const result = await runProcess(
			path.join(root, "node_modules", ".bin", "tsc"),
			["--project", "tsconfig.json"],
			{
				cwd: temporaryRoot,
			},
		);

		return { passed: result.code === 0, skipped: false, stderr: result.stderr || result.stdout };
	} finally {
		await rm(temporaryRoot, { force: true, recursive: true });
	}
}

function gradeDocuments(catalog, documents, task, variant) {
	if (variant === "baseline") {
		const expected = task.expected.packages.map(
			(packageName) => catalog.packages.find((candidate) => candidate.name === packageName)?.readmePath,
		);

		return expected.every((document) => document !== undefined && documents.includes(document)) ? 1 : 0;
	}

	const packageSkillsPresent = task.expected.packages.every((packageName) => {
		const skillPath = catalog.packages.find((candidate) => candidate.name === packageName)?.skillPath;
		return skillPath !== undefined && documents.includes(skillPath);
	});
	const referencesPresent = (task.expected.documentSuffixes ?? []).every((suffix) =>
		documents.some((document) => document === suffix || document.endsWith(`/${suffix}`)),
	);

	return packageSkillsPresent && referencesPresent ? 1 : 0;
}

function gradeImports(source, expectedPackages, allowedImports = []) {
	const imports = [...source.matchAll(/(?:from\s+|import\s*)["'](@serve-tools\/[^"']+)["']/g)].map(
		(match) => match[1],
	);

	if (imports.length === 0) {
		return 0;
	}

	const ownsImport = (packageName) =>
		imports.some((importName) => importName === packageName || importName.startsWith(`${packageName}/`));
	const unexpected = imports.filter(
		(importName) =>
			!expectedPackages.some(
				(packageName) => importName === packageName || importName.startsWith(`${packageName}/`),
			) && !allowedImports.includes(importName),
	);

	return expectedPackages.every(ownsImport) && unexpected.length === 0 ? 1 : 0;
}

function containsTerms(source, terms) {
	const normalized = source.toLowerCase();
	return terms.every((term) => normalized.includes(term.toLowerCase()));
}

function validateGeneratedFiles(value) {
	if (!Array.isArray(value) || value.length > 8) {
		throw new Error("A solution must contain at most 8 files");
	}

	return value.map((file) => {
		if (typeof file?.path !== "string" || typeof file.content !== "string") {
			throw new Error("Every generated file requires string path and content fields");
		}

		const normalized = path.posix.normalize(file.path);

		if (
			normalized.startsWith("../") ||
			path.posix.isAbsolute(normalized) ||
			!normalized.endsWith(".ts") ||
			file.content.length > 100_000
		) {
			throw new Error(`Unsafe generated file: ${file.path}`);
		}

		return { content: file.content, path: normalized };
	});
}

function sameSet(left, right) {
	return left.length === right.length && left.every((value) => right.includes(value));
}

function runProcess(command, arguments_, options) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, arguments_, { ...options, stdio: ["ignore", "pipe", "pipe"] });
		let stderr = "";
		let stdout = "";

		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stderr, stdout }));
	});
}
