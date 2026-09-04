import { typescript } from "@serve-tools/rolldown-typescript";

/** Create one plugin per Vite or Rolldown invocation, then pass it to the host's plugins array. */
export function createProjectPlugin() {
	return typescript({ configFile: "./tsconfig.json" });
}
