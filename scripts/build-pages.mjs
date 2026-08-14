import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const landingDirectory = join(repositoryDirectory, "demo");
const pagesDirectory = join(repositoryDirectory, "dist/pages");
const rootPackage = JSON.parse(await readFile(join(repositoryDirectory, "package.json"), "utf8"));
const demoLocations = rootPackage.workspaces.filter((location) =>
	/^(?:client|client-signals|lit)\/[^/]+\/demo$/.test(location),
);
const npmPath = process.env.npm_execpath;

if (npmPath === undefined) throw new Error("npm_execpath is unavailable");

await rm(pagesDirectory, { force: true, recursive: true });
await mkdir(dirname(pagesDirectory), { recursive: true });
await cp(landingDirectory, pagesDirectory, { recursive: true });

for (const location of demoLocations) {
	const demoPackage = JSON.parse(await readFile(join(repositoryDirectory, location, "package.json"), "utf8"));

	if (!demoPackage.private || typeof demoPackage.name !== "string") {
		throw new Error(`Pages demo must be a named private workspace: ${location}`);
	}

	console.log(`Building ${demoPackage.name}…`);
	execFileSync(process.execPath, [npmPath, "run", "build", "--workspace", demoPackage.name], {
		cwd: repositoryDirectory,
		stdio: "inherit",
	});

	const destination = join(pagesDirectory, location.slice(0, -"/demo".length));

	await mkdir(dirname(destination), { recursive: true });
	await cp(join(repositoryDirectory, location, "dist"), destination, { recursive: true });
}

console.log(`Built ${demoLocations.length} demos in ${pagesDirectory}`);
