import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { FixtureProvider, OpenAIProvider, publicizeRecipe } from "../lib/providers.mjs";

const root = path.resolve(import.meta.dirname, "../../..");

test("Fixture provider publicizes apply, decorators, and stream recipe imports", async () => {
	const provider = new FixtureProvider(root);
	const fixtures = [
		[
			"polyfills/report-error/test/polyfill-report-error.recipes.ts",
			"@serve-tools/polyfill-report-error",
			'await import("@serve-tools/polyfill-report-error/apply");',
		],
		[
			"lit/signals/test/lit-signals.recipes.ts",
			"@serve-tools/lit-signals",
			'from "@serve-tools/lit-signals/decorators"',
		],
		[
			"realtime/protocol/test/realtime-protocol.recipes.ts",
			"@serve-tools/realtime-protocol",
			'from "@serve-tools/realtime-protocol/stream"',
		],
	];

	for (const [goldenRecipe, packageName, expectedImport] of fixtures) {
		const result = await provider.solve({ task: { expected: { packages: [packageName] }, goldenRecipe } });

		assert.match(result.data.files[0].content, new RegExp(expectedImport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.doesNotMatch(result.data.files[0].content, /\.\.\/src\/(apply\/index|decorators|stream)\.js/);
	}
});

test("recipe publicizing preserves a literal escaped tab", () => {
	const source = 'const separator = "\\\\t";\nexport { value } from "../src/value.js";\n';
	const publicSource = publicizeRecipe(source, "@serve-tools/example");

	assert.match(publicSource, /const separator = "\\\\t"/);
	assert.match(publicSource, /from "@serve-tools\/example"/);
});

test("OpenAI provider requests strict structured output and records usage", async () => {
	let requestBody;

	const provider = new OpenAIProvider({
		apiKey: "test-key",
		fetchImplementation: async (_url, request) => {
			requestBody = JSON.parse(request.body);

			return new Response(
				JSON.stringify({
					output: [
						{
							content: [
								{
									text: JSON.stringify({
										packages: ["@serve-tools/client-db"],
										rationale: "fit",
									}),
									type: "output_text",
								},
							],
						},
					],
					usage: {
						input_tokens: 100,
						input_tokens_details: { cached_tokens: 25 },
						output_tokens: 20,
						output_tokens_details: { reasoning_tokens: 5 },
					},
				}),
				{ headers: { "Content-Type": "application/json" }, status: 200 },
			);
		},
		model: "test-model",
	});

	const result = await provider.route({
		discoveryContext: "catalog",
		task: { prompt: "Use IndexedDB" },
		variant: "skill",
	});

	assert.equal(requestBody.store, false);
	assert.equal(requestBody.text.format.strict, true);
	assert.equal(requestBody.text.format.type, "json_schema");
	assert.deepEqual(requestBody.text.format.schema.required, ["packages", "rationale"]);
	assert.deepEqual(result.data.packages, ["@serve-tools/client-db"]);
	assert.equal(result.metrics.inputTokens, 100);
	assert.equal(result.metrics.cachedInputTokens, 25);
	assert.equal(result.metrics.reasoningTokens, 5);
});

test("OpenAI provider keeps focused document selection in a separate structured request", async () => {
	let requestBody;

	const provider = new OpenAIProvider({
		apiKey: "test-key",
		fetchImplementation: async (_url, request) => {
			requestBody = JSON.parse(request.body);

			return new Response(
				JSON.stringify({
					output: [
						{
							content: [
								{
									text: JSON.stringify({
										documents: ["client/db/skills/use-client-db/references/recipe-query.md"],
										rationale: "focused",
									}),
									type: "output_text",
								},
							],
						},
					],
				}),
				{ headers: { "Content-Type": "application/json" }, status: 200 },
			);
		},
		model: "test-model",
	});

	const result = await provider.selectDocuments({
		route: { packages: ["@serve-tools/client-db"] },
		routers: "<document>router</document>",
		task: { prompt: "Query IndexedDB" },
	});

	assert.equal(requestBody.text.format.name, "document_route");
	assert.deepEqual(requestBody.text.format.schema.required, ["documents", "rationale"]);
	assert.match(requestBody.input[1].content, /<selected-packages>/);
	assert.deepEqual(result.data.documents, ["client/db/skills/use-client-db/references/recipe-query.md"]);
});
