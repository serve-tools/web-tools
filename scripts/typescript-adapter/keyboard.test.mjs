import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build } from "vite";
import { runPilot } from "./pilot.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const compiler = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));

test("the client-keyboard demo matches CLI production output and reloads compiler edits", {
	timeout: 90_000,
}, async (context) => {
	const fixture = await createKeyboardFixture();
	let browser;
	let page;
	let server;

	context.after(async () => {
		await page?.close();
		await browser?.close();
		await server?.close();
		await fixture.dispose();
	});

	assert.equal(await directoryExists(fixture.output), false, "isolated fixture copied physical compiler output");
	const adapterBuild = await runPilot({
		root: fixture.demo,
		mode: "build",
		vite: { build: { write: false }, logLevel: "silent" },
	});
	assert.equal(await directoryExists(fixture.output), false, "adapter production build wrote compiler output");

	const command = spawnSync(
		process.execPath,
		[compiler, "--build", fixture.project, "--force", "--pretty", "false"],
		{
			cwd: fixture.root,
			encoding: "utf8",
			timeout: 30_000,
		},
	);
	assert.equal(command.status, 0, command.stdout + command.stderr);
	const cliBuild = await build({
		root: fixture.demo,
		build: { write: false },
		logLevel: "silent",
	});
	const adapterChunks = productionChunks(adapterBuild);
	const cliChunks = productionChunks(cliBuild);
	assert.deepEqual(adapterChunks, cliChunks);
	context.diagnostic(
		`production chunk parity: ${JSON.stringify(
			adapterChunks.map(({ code, fileName }) => ({ bytes: Buffer.byteLength(code), fileName })),
		)}`,
	);

	await rm(fixture.output, { force: true, recursive: true });
	server = await runPilot({
		root: fixture.demo,
		vite: {
			logLevel: "silent",
			server: { host: "127.0.0.1", port: 0, strictPort: false },
		},
	});
	assert.equal(await directoryExists(fixture.output), false, "adapter dev server wrote compiler output");
	const address = server.httpServer.address();
	assert.ok(address && typeof address === "object", "Vite did not expose its loopback address");

	browser = await chromium.launch({ headless: true });
	page = await browser.newPage();
	const pageErrors = [];
	let loads = 0;
	page.on("load", () => ++loads);
	page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
	await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: "networkidle" });
	const initialLoads = loads;
	const platform = await page.locator("#capture").getAttribute("data-platform");
	const modifier = platform === "Apple" ? "Meta" : "Control";
	const initialLabel = platform === "Apple" ? "Command and K" : "Control and K";
	const updatedLabel = platform === "Apple" ? "Command key and K" : "Control key and K";
	await assertKeyboardResult(page, modifier, initialLabel);

	const source = await readFile(fixture.keyboardSource, "utf8");
	const updatedSource = source.replace(
		'Mod: isApplePlatform ? "Command" : "Control",',
		'Mod: isApplePlatform ? "Command key" : "Control key",',
	);
	assert.notEqual(updatedSource, source, "keyboard label edit did not match the real package source");
	await writeFile(fixture.keyboardSource, updatedSource);
	await until(async () => {
		try {
			await assertKeyboardResult(page, modifier, updatedLabel);
			return true;
		} catch {
			return false;
		}
	}, "browser did not observe the compiler-backed keyboard label edit");
	assert.ok(
		loads > initialLoads,
		"dependency edit neither reloaded the unaccepted demo graph nor produced observable HMR",
	);
	assert.equal(await directoryExists(fixture.output), false, "dependency edit wrote compiler output");
	assert.deepEqual(pageErrors, []);
	context.diagnostic(`browser keyboard result: ${JSON.stringify({ initialLabel, updatedLabel, loads, platform })}`);

	await page.close();
	await browser.close();
	await server.close();
});

async function createKeyboardFixture() {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), "web-tools-ts-adapter-keyboard-")));
	const keyboard = path.join(root, "client/keyboard");
	const demo = path.join(keyboard, "demo");
	await mkdir(demo, { recursive: true });
	await cp(path.join(repository, "tsconfig.json"), path.join(root, "tsconfig.json"));
	for (const name of ["package.json", "tsconfig.json"]) {
		await cp(path.join(repository, "client/keyboard", name), path.join(keyboard, name));
	}
	await cp(path.join(repository, "client/keyboard/src"), path.join(keyboard, "src"), { recursive: true });
	for (const name of ["index.html", "package.json", "tsconfig.json", "vite.config.ts"]) {
		await cp(path.join(repository, "client/keyboard/demo", name), path.join(demo, name));
	}
	await cp(path.join(repository, "client/keyboard/demo/src"), path.join(demo, "src"), { recursive: true });

	await mkdir(path.join(root, "node_modules/@serve-tools"), { recursive: true });
	const linkType = process.platform === "win32" ? "junction" : "dir";
	await symlink(path.join(repository, "node_modules/vite"), path.join(root, "node_modules/vite"), linkType);
	await symlink(keyboard, path.join(root, "node_modules/@serve-tools/client-keyboard"), linkType);

	return {
		demo,
		keyboardSource: path.join(keyboard, "src/lib/keyboard.ts"),
		output: path.join(keyboard, "dist"),
		project: path.join(keyboard, "tsconfig.json"),
		root,
		async dispose() {
			await rm(root, { force: true, recursive: true });
		},
	};
}

function productionChunks(result) {
	const outputs = Array.isArray(result) ? result.flatMap(({ output }) => output) : result.output;
	return outputs
		.filter((output) => output.type === "chunk")
		.map(({ code, fileName, imports, dynamicImports }) => ({ code, dynamicImports, fileName, imports }))
		.sort((left, right) => left.fileName.localeCompare(right.fileName));
}

async function assertKeyboardResult(page, modifier, label) {
	const capture = page.locator("#capture");
	await capture.press(`${modifier}+K`);
	await assertLocatorText(page, "#canonical", "Mod+K");
	await assertLocatorText(page, "#label", label);
	await assertLocatorText(page, "#aria", `${modifier === "Meta" ? "Meta" : "Control"}+K`);
	assert.deepEqual(await page.locator("#symbols kbd").allTextContents(), [modifier === "Meta" ? "⌘" : "⌃", "K"]);
	assert.equal(await page.locator('[data-chord="Mod+K"]').getAttribute("data-matched"), "");
}

async function assertLocatorText(page, selector, expected) {
	assert.equal(await page.locator(selector).textContent(), expected);
}

async function directoryExists(directory) {
	try {
		return (await realpath(directory)) !== undefined;
	} catch (error) {
		if (error.code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

async function until(predicate, message) {
	const end = Date.now() + 15_000;
	while (Date.now() < end) {
		if (await predicate()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	assert.fail(message);
}
