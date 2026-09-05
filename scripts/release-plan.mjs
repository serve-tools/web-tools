import { execFileSync } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspaceInventory } from "./workspaces.mjs";

const require = createRequire(import.meta.url);

export async function readPublishableWorkspaces(root) {
	const { publicWorkspaces } = await readWorkspaceInventory(root);

	return publicWorkspaces.map(({ location, manifest }) => ({ location, manifest }));
}

async function readPackageVersions(packageName, registryURL) {
	for (let attempt = 1; attempt <= 3; ++attempt) {
		try {
			const response = await fetch(new URL(encodeURIComponent(packageName), registryURL), {
				headers: { accept: "application/vnd.npm.install-v1+json" },
			});
			if (response.status === 404) {
				return [];
			}
			if (response.ok) {
				const packument = await response.json();
				return Object.keys(packument.versions ?? {});
			}

			throw new Error(`npm registry returned ${response.status} for ${packageName}`);
		} catch (error) {
			if (attempt === 3) {
				throw new Error(`Could not read npm versions for ${packageName}: ${error.message}`);
			}
		}

		await new Promise((resolve) => setTimeout(resolve, attempt * 500));
	}
}

export async function readPublishedVersions(packages, registry = "https://registry.npmjs.org/") {
	const registryURL = new URL(registry.endsWith("/") ? registry : `${registry}/`);

	return new Map(
		await Promise.all(
			packages.map(async ({ manifest }) => [
				manifest.name,
				await readPackageVersions(manifest.name, registryURL),
			]),
		),
	);
}

export function createReleasePlan({ packages, publishedVersions, selector, requestedVersion, satisfies, valid }) {
	const packagesByName = new Map(packages.map((packageData) => [packageData.manifest.name, packageData]));
	let selected;

	if (selector === "all") {
		if (requestedVersion) {
			throw new Error("Leave version empty when publishing all prepared packages");
		}

		selected = packages.filter(
			({ manifest }) => !(publishedVersions.get(manifest.name) ?? []).includes(manifest.version),
		);
		if (selected.length === 0) {
			throw new Error("Every publishable workspace version is already published");
		}
	} else {
		const packageData = packagesByName.get(selector);
		if (!packageData) {
			throw new Error(`Unknown publishable package: ${selector}`);
		}
		if (!requestedVersion) {
			throw new Error("An exact version is required for a single-package release");
		}
		if (packageData.manifest.version !== requestedVersion) {
			throw new Error(
				`Expected ${packageData.manifest.name}@${packageData.manifest.version}, received ${requestedVersion}`,
			);
		}
		if ((publishedVersions.get(packageData.manifest.name) ?? []).includes(packageData.manifest.version)) {
			throw new Error(`${packageData.manifest.name}@${packageData.manifest.version} is already published`);
		}

		selected = [packageData];
	}

	for (const { manifest } of selected) {
		if (!valid(manifest.version)) {
			throw new Error(`${manifest.name} has invalid release version ${manifest.version}`);
		}
	}

	const selectedByName = new Map(selected.map((packageData) => [packageData.manifest.name, packageData]));
	const dependencies = new Map(selected.map(({ manifest }) => [manifest.name, new Set()]));

	for (const { manifest } of selected) {
		const internalDependencies = [
			...Object.entries(manifest.dependencies ?? {}),
			...Object.entries(manifest.optionalDependencies ?? {}),
			...Object.entries(manifest.peerDependencies ?? {}),
		];

		for (const [dependencyName, range] of internalDependencies) {
			if (!dependencyName.startsWith("@serve-tools/")) {
				continue;
			}

			const dependency = packagesByName.get(dependencyName);
			if (!dependency) {
				throw new Error(`${manifest.name} depends on unknown internal package ${dependencyName}`);
			}

			const selectedDependency = selectedByName.get(dependencyName);
			const selectedVersionMatches = selectedDependency && satisfies(selectedDependency.manifest.version, range);
			const publishedVersionMatches = (publishedVersions.get(dependencyName) ?? []).some((version) =>
				satisfies(version, range),
			);

			if (selectedVersionMatches) {
				dependencies.get(manifest.name).add(dependencyName);
			} else if (!publishedVersionMatches) {
				throw new Error(`${manifest.name} requires unavailable ${dependencyName}@${range}`);
			}
		}
	}

	const ordered = [];
	const visiting = new Set();
	const visited = new Set();

	function visit(packageName) {
		if (visited.has(packageName)) {
			return;
		}
		if (visiting.has(packageName)) {
			throw new Error(`Internal release dependency cycle includes ${packageName}`);
		}

		visiting.add(packageName);
		for (const dependencyName of [...dependencies.get(packageName)].sort()) {
			visit(dependencyName);
		}
		visiting.delete(packageName);
		visited.add(packageName);
		ordered.push(selectedByName.get(packageName));
	}

	for (const packageName of [...selectedByName.keys()].sort()) {
		visit(packageName);
	}

	return ordered.map(({ location, manifest }) => ({
		name: manifest.name,
		version: manifest.version,
		path: location,
	}));
}

export function loadSemver() {
	// Release planning runs before npm ci, so use semver bundled by the repository's pinned global npm.
	if (process.env.npm_execpath) {
		return createRequire(process.env.npm_execpath)("semver");
	}

	const globalRoot = execFileSync("npm", ["root", "--global"], {
		encoding: "utf8",
		shell: process.platform === "win32",
	}).trim();
	return require(path.join(globalRoot, "npm", "node_modules", "semver"));
}

async function main() {
	const root = process.cwd();
	const selector = process.env.RELEASE_PACKAGE?.trim();
	const requestedVersion = process.env.RELEASE_VERSION?.trim();
	const releaseDirectory = process.env.RELEASE_DIRECTORY;
	if (!selector) {
		throw new Error("RELEASE_PACKAGE is required");
	}
	if (!releaseDirectory) {
		throw new Error("RELEASE_DIRECTORY is required");
	}

	const packages = await readPublishableWorkspaces(root);
	const publishedVersions = await readPublishedVersions(packages, process.env.npm_config_registry);
	const { satisfies, valid } = loadSemver();
	const plan = createReleasePlan({ packages, publishedVersions, selector, requestedVersion, satisfies, valid });

	await mkdir(releaseDirectory, { recursive: true });
	await writeFile(path.join(releaseDirectory, "release-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);

	const summary = plan.map(({ name, version }) => `${name}@${version}`).join(", ");
	if (process.env.GITHUB_OUTPUT) {
		await appendFile(process.env.GITHUB_OUTPUT, `count=${plan.length}\npackages=${summary}\n`);
	}
	if (process.env.GITHUB_STEP_SUMMARY) {
		await appendFile(
			process.env.GITHUB_STEP_SUMMARY,
			`## Release plan\n\n${plan.map(({ name, version }) => `- \`${name}@${version}\``).join("\n")}\n`,
		);
	}

	console.log(`Prepared dependency-ordered plan for ${summary}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`::error::${error.message}`);
		process.exitCode = 1;
	});
}
