import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const typescriptDirectory = dirname(require.resolve("typescript/package.json"));
const typescriptCLI = join(typescriptDirectory, "bin", "tsc");
const compiledDirectory = mkdtempSync(join(tmpdir(), "serve-tools-lit-signals-demo-"));

export default defineConfig({
	base: "./",
	plugins: [
		{
			name: "transform-demo-decorators",
			transform(_code, id) {
				if (!id.includes("/src/examples/") || !id.endsWith(".ts")) {
					return;
				}

				execFileSync(
					process.execPath,
					[
						typescriptCLI,
						"--ignoreConfig",
						id,
						"--target",
						"ES2022",
						"--module",
						"ESNext",
						"--moduleResolution",
						"bundler",
						"--skipLibCheck",
						"--outDir",
						compiledDirectory,
					],
					{ stdio: "inherit" },
				);

				const output = join(compiledDirectory, `${basename(id, extname(id))}.js`);

				return { code: readFileSync(output, "utf8") };
			},
			closeBundle() {
				rmSync(compiledDirectory, { force: true, recursive: true });
			},
		},
	],
});
