import { typescriptProject as createPlugin } from "./internal/plugin.mjs";

/** Configuration for one compiler graph and one Vite or Rolldown invocation. */
export interface TypeScriptProjectOptions {
	/** Root project configuration, resolved relative to cwd. Defaults to tsconfig.json. */
	readonly configFile?: string;

	/** Compiler working directory. Defaults to process.cwd(). */
	readonly cwd?: string;

	/** Additional package export conditions, alongside the host's conditions. */
	readonly conditions?: readonly string[];
}

/** The plugin owns its compiler until the host closes it or disposal is requested explicitly. */
export interface TypeScriptProjectPlugin {
	/** Plugin name reported by Vite and Rolldown. */
	readonly name: string;

	/** Explicit cleanup for programmatic setup failures before the host takes ownership. */
	readonly api: {
		/** Close the compiler after pending work finishes. Repeated calls share the same completion. */
		dispose(): Promise<void>;
	};
}

/**
 * Create a plugin immediately; the host awaits compiler initialization before serving or building.
 */
export function typescript(options: TypeScriptProjectOptions = {}): TypeScriptProjectPlugin {
	return createPlugin(options);
}
