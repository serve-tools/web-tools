import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API } from "typescript/unstable/async";
import { readWorkspaceInventory } from "./workspaces.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const rootBuildConfig = JSON.parse(await readFile(new URL("../tsconfig.build.json", import.meta.url)));
const typescript = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));
const rootBuildProjects = new Set(rootBuildConfig.references.map((reference) => reference.path.replace(/^\.\//, "")));
const { workspaces, workspacesByName } = await readWorkspaceInventory(root);
const typechecks = [];

for (const workspace of workspaces) {
	collectTypechecks(workspace, "typecheck");
}

function collectTypechecks(currentWorkspace, scriptName) {
	const { location, manifest, name, root: workspaceRoot } = currentWorkspace;
	const script = manifest.scripts?.[scriptName];

	if (!script) {
		return;
	}

	for (const command of script.split(/\s*&&\s*/)) {
		const match = /^tsc --project (\S+)( --noEmit)?$/.exec(command);

		if (match) {
			typechecks.push({
				args: ["--project", match[1], ...(match[2] ? ["--noEmit"] : [])],
				configFile: path.join(workspaceRoot, match[1]),
				name,
				noEmit: Boolean(match[2]),
				workspace: location,
				workspaceRoot,
			});
			continue;
		}

		if (/^npm run build(?::dependencies)?(?: --workspace \S+)*$/.test(command)) {
			assertRootBuildCovers(command, currentWorkspace);
			continue;
		}

		if (command === "node scripts/build-local-dependency.mjs") {
			for (const dependency of Object.keys(manifest.dependencies ?? {})) {
				const dependencyWorkspace = workspacesByName.get(dependency);

				if (dependencyWorkspace) {
					assertRootBuildCovers("npm run build", dependencyWorkspace);
				}
			}
			continue;
		}

		if (command === "npm run typecheck:local") {
			collectTypechecks(currentWorkspace, "typecheck:local");
			continue;
		}

		throw new Error(`Unsupported ${scriptName} command in ${location}/package.json: ${command}`);
	}
}

function assertRootBuildCovers(command, currentWorkspace) {
	const match = /^npm run (build(?::dependencies)?)((?: --workspace \S+)*)$/.exec(command);

	if (!match) {
		throw new Error(
			`Unsupported dependency-build command in ${currentWorkspace.location}/package.json: ${command}`,
		);
	}

	const workspaceNames = [...match[2].matchAll(/--workspace (\S+)/g)].map((workspaceMatch) => workspaceMatch[1]);
	const targetWorkspaces = workspaceNames.length
		? workspaceNames.map((workspaceName) => {
				const targetWorkspace = workspacesByName.get(workspaceName);

				if (!targetWorkspace) {
					throw new Error(`Unknown workspace in build command: ${workspaceName}`);
				}
				return targetWorkspace;
			})
		: [currentWorkspace];

	for (const targetWorkspace of targetWorkspaces) {
		const { location, manifest, name } = targetWorkspace;
		const buildScript = manifest.scripts?.[match[1]];

		if (!buildScript) {
			throw new Error(`Missing ${match[1]} script in ${location}/package.json`);
		}

		if (match[1] === "build:dependencies") {
			for (const dependencyBuild of buildScript.split(/\s*&&\s*/)) {
				assertRootBuildCovers(dependencyBuild, targetWorkspace);
			}
			continue;
		}

		const typescriptBuild = /^tsc --build (\S+)$/.exec(buildScript);
		const project = typescriptBuild && `${location}/${typescriptBuild[1]}`;

		if (!project || !rootBuildProjects.has(project)) {
			throw new Error(`Root TypeScript build does not fully replace ${name}'s build script: ${buildScript}`);
		}
	}
}

console.log(`Typechecking ${typechecks.length} workspace projects without rebuilding the root project graph.`);

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "web-tools-typecheck-"));
let api;
let snapshot;

try {
	// Overlay configs preserve command-line --noEmit semantics; the symlink preserves config-relative type resolution.
	await symlink(
		path.join(root, "node_modules"),
		path.join(temporaryDirectory, "node_modules"),
		process.platform === "win32" ? "junction" : "dir",
	);

	await Promise.all(
		typechecks.map(async (typecheck, index) => {
			typecheck.openConfigFile = typecheck.configFile;

			if (!typecheck.noEmit) {
				return;
			}

			typecheck.openConfigFile = path.join(temporaryDirectory, `${index}.json`);

			await writeFile(
				typecheck.openConfigFile,
				JSON.stringify({ extends: typecheck.configFile, compilerOptions: { noEmit: true } }),
			);
		}),
	);

	api = new API({ cwd: root });
	snapshot = await api.updateSnapshot({ openProjects: typechecks.map(({ openConfigFile }) => openConfigFile) });

	const diagnosticCounts = await Promise.all(
		typechecks.map((typecheck) => {
			const project = snapshot.getProject(typecheck.openConfigFile);

			if (!project) {
				throw new Error(`TypeScript did not open project: ${typecheck.configFile}`);
			}

			return countPreEmitDiagnostics(project);
		}),
	);

	for (let index = 0; index < typechecks.length; ++index) {
		const typecheck = typechecks[index];

		console.log(`\n> ${typecheck.name} ${typecheck.args.join(" ")}`);

		if (diagnosticCounts[index] === 0) {
			continue;
		}

		const result = spawnSync(process.execPath, [typescript, ...typecheck.args], {
			cwd: typecheck.workspaceRoot,
			stdio: "inherit",
		});

		if (result.error) {
			throw result.error;
		}
		if (result.status === 0) {
			throw new Error(`Batched TypeScript diagnostics disagreed with ${typecheck.workspace}/package.json`);
		}

		process.exitCode = result.status ?? 1;
		break;
	}
} finally {
	try {
		try {
			if (snapshot) {
				await snapshot.dispose();
			}
		} finally {
			if (api) {
				await api.close();
			}
		}
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true });
	}
}

async function countPreEmitDiagnostics(project) {
	// Keep this order and gating aligned with TypeScript's compiler.GetDiagnosticsOfAnyProgram.
	const { program } = project;
	const [configFileParsingDiagnostics, syntacticDiagnostics] = await Promise.all([
		program.getConfigFileParsingDiagnostics(),
		program.getSyntacticDiagnostics(),
	]);
	const configFileParsingDiagnosticsLength = configFileParsingDiagnostics.length;
	let diagnosticCount = configFileParsingDiagnosticsLength + syntacticDiagnostics.length;

	if (syntacticDiagnostics.length > 0) {
		return diagnosticCount;
	}

	diagnosticCount += (await program.getProgramDiagnostics()).length;

	await program.getBindDiagnostics();

	if (project.compilerOptions.listFilesOnly) {
		return diagnosticCount;
	}

	diagnosticCount += (await program.getGlobalDiagnostics()).length;

	if (diagnosticCount === configFileParsingDiagnosticsLength) {
		diagnosticCount += (await program.getSemanticDiagnostics()).length;
		diagnosticCount += (await program.getGlobalDiagnostics()).length;
	}

	const emitDeclarations = project.compilerOptions.declaration || project.compilerOptions.composite;

	if (project.compilerOptions.noEmit && emitDeclarations && diagnosticCount === configFileParsingDiagnosticsLength) {
		diagnosticCount += (await program.getDeclarationDiagnostics()).length;
	}

	return diagnosticCount;
}
