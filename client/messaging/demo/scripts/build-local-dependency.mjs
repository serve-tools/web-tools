import { existsSync } from "node:fs";

const sharedBuildURL = new URL("../../../../scripts/build-demo-dependencies.mjs", import.meta.url);

if (existsSync(sharedBuildURL)) {
	const { buildDemoDependencies } = await import(sharedBuildURL.href);

	await buildDemoDependencies(new URL("../package.json", import.meta.url));
}
