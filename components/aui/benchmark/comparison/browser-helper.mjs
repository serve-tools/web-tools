export const fixtureHTML = `<!doctype html>
<html>
<head>
<style>
[data-bench-row] { display: flex; align-items: center; gap: 4px; }
[data-bench-control] {
	appearance: none;
	box-sizing: border-box;
	display: inline-block;
	width: 16px;
	height: 16px;
	margin: 0;
	padding: 0;
	border: 1px solid currentColor;
}
</style>
</head>
<body></body>
</html>`;

export const createIsolatedPage = async (browser, bundlePath, errors) => {
	const page = await browser.newPage();
	page.on("console", (message) => {
		if (message.type() === "error") {
			errors.push(`console: ${message.text()}`);
		}
	});
	page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
	await page.route("https://aui-benchmark.test/**", (route) =>
		route.fulfill({
			body: fixtureHTML,
			contentType: "text/html",
			headers: {
				"Cross-Origin-Embedder-Policy": "require-corp",
				"Cross-Origin-Opener-Policy": "same-origin",
			},
			status: 200,
		}),
	);
	await page.goto("https://aui-benchmark.test/");
	await page.addScriptTag({ path: bundlePath });
	return page;
};

export const evaluateBench = (page, method, args = [], timeoutMs = 10_000) =>
	page.evaluate(
		async ({ args, method, timeoutMs }) => {
			let timeoutId;
			const timeout = new Promise((_, reject) => {
				timeoutId = setTimeout(() => reject(new Error(`Benchmark ${method} timed out`)), timeoutMs);
			});
			try {
				return await Promise.race([globalThis.__checkboxBench[method](...args), timeout]);
			} finally {
				clearTimeout(timeoutId);
			}
		},
		{ args, method, timeoutMs },
	);

export const measureTimerQuantum = (sampleCount = 200) => {
	const differences = [];
	let previous = performance.now();
	for (let attempt = 0; attempt < 10_000_000 && differences.length < sampleCount; ++attempt) {
		const current = performance.now();
		if (current > previous) {
			differences.push(current - previous);
			previous = current;
		}
	}
	differences.sort((a, b) => a - b);
	return {
		maxMs: differences.at(-1),
		medianMs: differences[Math.floor(differences.length / 2)],
		minMs: differences[0],
		sampleCount: differences.length,
	};
};
