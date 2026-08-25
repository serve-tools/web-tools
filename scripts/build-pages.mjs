import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspaceInventory } from "./workspaces.mjs";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const landingDirectory = join(repositoryDirectory, "demo");
const pagesDirectory = join(repositoryDirectory, "dist/pages");
const workspaceInventory = await readWorkspaceInventory(repositoryDirectory);
const demos = workspaceInventory.workspaces.filter((workspace) =>
	/^(?:client|client-signals|lit)\/[^/]+\/demo$/.test(workspace.location),
);
const npmPath = process.env.npm_execpath;

if (npmPath === undefined) {
	throw new Error("npm_execpath is unavailable");
}

await rm(pagesDirectory, { force: true, recursive: true });
await mkdir(dirname(pagesDirectory), { recursive: true });
await cp(landingDirectory, pagesDirectory, { recursive: true });

for (const demo of demos) {
	if (!demo.manifest.private || typeof demo.name !== "string") {
		throw new Error(`Pages demo must be a named private workspace: ${demo.location}`);
	}
}

const demoNames = demos.map((demo) => demo.name);
const workspaceArguments = demoNames.flatMap((name) => ["--workspace", name]);

console.log("Building the shared TypeScript project graph…");
execFileSync(process.execPath, [npmPath, "run", "build:typescript"], {
	cwd: repositoryDirectory,
	stdio: "inherit",
});

console.log(`Typechecking ${demos.length} demos against the shared graph…`);
execFileSync(process.execPath, [npmPath, "run", "typecheck:local", ...workspaceArguments], {
	cwd: repositoryDirectory,
	stdio: "inherit",
});

console.log(`Bundling ${demos.length} demos…`);
execFileSync(process.execPath, [npmPath, "run", "build:bundle", ...workspaceArguments], {
	cwd: repositoryDirectory,
	stdio: "inherit",
});

for (const demo of demos) {
	const destination = join(pagesDirectory, demo.location.slice(0, -"/demo".length));

	await mkdir(dirname(destination), { recursive: true });
	await cp(join(demo.root, "dist"), destination, { recursive: true });
}

console.log(`Built ${demos.length} demos in ${pagesDirectory}`);
