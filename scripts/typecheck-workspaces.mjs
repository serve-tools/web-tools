import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const rootBuildConfig = JSON.parse(readFileSync(new URL("../tsconfig.build.json", import.meta.url)));
const typescript = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));
const rootBuildProjects = new Set(rootBuildConfig.references.map((reference) => reference.path.replace(/^\.\//, "")));
const workspacesByName = new Map();
const typechecks = [];

for (const workspace of rootPackage.workspaces) {
	const packageJson = JSON.parse(readFileSync(new URL(`../${workspace}/package.json`, import.meta.url)));

	workspacesByName.set(packageJson.name, { packageJson, workspace });
}

for (const currentWorkspace of workspacesByName.values()) {
	collectTypechecks(currentWorkspace, "typecheck");
}

function collectTypechecks(currentWorkspace, scriptName) {
	const { packageJson, workspace } = currentWorkspace;
	const script = packageJson.scripts?.[scriptName];

	if (!script) {
		return;
	}

	for (const command of script.split(/\s*&&\s*/)) {
		const match = /^tsc --project (\S+)( --noEmit)?$/.exec(command);

		if (match) {
			typechecks.push({
				args: ["--project", match[1], ...(match[2] ? ["--noEmit"] : [])],
				name: packageJson.name,
				workspace,
			});
			continue;
		}

		if (/^npm run build(?::dependencies)?(?: --workspace \S+)*$/.test(command)) {
			assertRootBuildCovers(command, currentWorkspace);
			continue;
		}

		if (command === "node scripts/build-local-dependency.mjs") {
			for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
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

		throw new Error(`Unsupported ${scriptName} command in ${workspace}/package.json: ${command}`);
	}
}

function assertRootBuildCovers(command, currentWorkspace) {
	const match = /^npm run (build(?::dependencies)?)((?: --workspace \S+)*)$/.exec(command);

	if (!match) {
		throw new Error(
			`Unsupported dependency-build command in ${currentWorkspace.workspace}/package.json: ${command}`,
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
		const { packageJson, workspace } = targetWorkspace;
		const buildScript = packageJson.scripts?.[match[1]];

		if (!buildScript) {
			throw new Error(`Missing ${match[1]} script in ${workspace}/package.json`);
		}

		if (match[1] === "build:dependencies") {
			for (const dependencyBuild of buildScript.split(/\s*&&\s*/)) {
				assertRootBuildCovers(dependencyBuild, targetWorkspace);
			}
			continue;
		}

		const typescriptBuild = /^tsc --build (\S+)$/.exec(buildScript);
		const project = typescriptBuild && `${workspace}/${typescriptBuild[1]}`;

		if (!project || !rootBuildProjects.has(project)) {
			throw new Error(
				`Root TypeScript build does not fully replace ${packageJson.name}'s build script: ${buildScript}`,
			);
		}
	}
}

console.log(`Typechecking ${typechecks.length} workspace projects without rebuilding the root project graph.`);

for (const typecheck of typechecks) {
	console.log(`\n> ${typecheck.name} ${typecheck.args.join(" ")}`);

	const result = spawnSync(process.execPath, [typescript, ...typecheck.args], {
		cwd: fileURLToPath(new URL(`../${typecheck.workspace}/`, import.meta.url)),
		stdio: "inherit",
	});

	if (result.error) {
		throw result.error;
	}
	if (result.status === 0) {
		continue;
	}

	process.exitCode = result.status ?? 1;
	break;
}
