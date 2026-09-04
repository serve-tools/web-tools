import type { TypeScriptProjectOptions, TypeScriptProjectPlugin } from "@serve-tools/rolldown-typescript";
import { typescript } from "@serve-tools/rolldown-typescript";
import type { Plugin as RolldownPlugin } from "rolldown";
import type { Plugin as VitePlugin } from "vite";

const options = { configFile: "./tsconfig.json", conditions: ["browser"] } as const satisfies TypeScriptProjectOptions;

/** The same declared plugin shape is assignable to both hosts. */
export function acceptsBothHosts() {
	const plugin: TypeScriptProjectPlugin = typescript(options);
	const rolldownPlugin: RolldownPlugin = plugin;
	const vitePlugin: VitePlugin = plugin;
	const completion: Promise<void> = plugin.api.dispose();
	return { rolldownPlugin, vitePlugin, completion };
}

// @ts-expect-error compiler configurations are filenames, not parsed configuration objects.
const invalidOptions: TypeScriptProjectOptions = { configFile: {} };
void invalidOptions;
