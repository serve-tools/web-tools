import { readFile } from "node:fs/promises";
import path from "node:path";

export class FixtureProvider {
	constructor(root) {
		this.root = root;
	}

	async route({ task }) {
		return {
			data: { documents: [], packages: task.expected.packages, rationale: "Deterministic fixture route." },
			metrics: emptyMetrics(),
		};
	}

	async selectDocuments({ catalog, route, task }) {
		const documents = [];

		for (const packageName of route.packages) {
			const packageEntry = catalog.packages.find((candidate) => candidate.name === packageName);

			if (packageEntry === undefined) {
				continue;
			}

			for (const suffix of task.expected.documentSuffixes ?? []) {
				const reference = packageEntry.references.find(
					(candidate) => candidate.path === suffix || candidate.path.endsWith(`/${suffix}`),
				);

				if (reference !== undefined) {
					documents.push(reference.path);
				}
			}
		}

		return { data: { documents, rationale: "Deterministic fixture documents." }, metrics: emptyMetrics() };
	}

	async solve({ task }) {
		const files = [];

		if (task.goldenRecipe !== undefined) {
			const source = await readFile(path.join(this.root, task.goldenRecipe), "utf8");
			files.push({ content: publicizeRecipe(source, task.expected.packages[0]), path: "solution.ts" });
		}

		return {
			data: {
				answer: task.fixtureAnswer ?? "The selected package directly owns the requested capability.",
				files,
			},
			metrics: emptyMetrics(),
		};
	}
}

export class OpenAIProvider {
	constructor({ apiKey, fetchImplementation = fetch, model, reasoningEffort = "low" }) {
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY is required for the OpenAI provider");
		}
		if (!model) {
			throw new Error("--model is required for the OpenAI provider");
		}

		this.apiKey = apiKey;
		this.fetch = fetchImplementation;
		this.model = model;
		this.reasoningEffort = reasoningEffort;
	}

	async route({ discoveryContext, task, variant }) {
		return this.#complete({
			name: "package_route",
			schema: packageRouteSchema,
			system: [
				"Select the smallest exact @serve-tools package set for the task.",
				"Do not choose @serve-tools/skills as an implementation dependency.",
				`This is the ${variant} documentation condition.`,
			].join("\n"),
			user: `<task>\n${task.prompt}\n</task>\n\n${discoveryContext}`,
		});
	}

	async selectDocuments({ route, routers, task }) {
		return this.#complete({
			name: "document_route",
			schema: documentRouteSchema,
			system: [
				"Select only the focused reference paths needed to solve the task.",
				"Use only paths linked from the supplied package Skill routers.",
				"Do not select README files, SKILL.md itself, or references that do not affect the answer.",
			].join("\n"),
			user: [
				`<task>\n${task.prompt}\n</task>`,
				`<selected-packages>\n${route.packages.join("\n")}\n</selected-packages>`,
				routers,
			].join("\n\n"),
		});
	}

	async solve({ documents, route, task }) {
		return this.#complete({
			name: "skill_solution",
			schema: solutionSchema,
			system: [
				"Solve the task using only the supplied package documents.",
				"Preserve public API names, ownership, cancellation, failure, and cleanup semantics.",
				"For implementation tasks, return complete compile-ready TypeScript in files. Use only public package imports.",
				"For design tasks, give a concise actionable answer and return an empty files array.",
			].join("\n"),
			user: [
				`<task>\n${task.prompt}\n</task>`,
				`<selected-packages>\n${route.packages.join("\n")}\n</selected-packages>`,
				documents,
			].join("\n\n"),
		});
	}

	async #complete({ name, schema, system, user }) {
		const startedAt = performance.now();
		let response;

		for (let attempt = 0; attempt < 3; ++attempt) {
			response = await this.fetch("https://api.openai.com/v1/responses", {
				body: JSON.stringify({
					input: [
						{ content: system, role: "system" },
						{ content: user, role: "user" },
					],
					model: this.model,
					reasoning: { effort: this.reasoningEffort },
					store: false,
					text: {
						format: { name, schema, strict: true, type: "json_schema" },
						verbosity: "low",
					},
				}),
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				method: "POST",
				signal: AbortSignal.timeout(180_000),
			});

			if (response.ok || (response.status !== 429 && response.status < 500)) {
				break;
			}
			if (attempt < 2) {
				await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
			}
		}

		const responseBody = await response.json();

		if (!response.ok) {
			throw new Error(
				`OpenAI Responses API returned ${response.status}: ${responseBody.error?.message ?? "unknown error"}`,
			);
		}

		const outputText = responseBody.output
			?.flatMap((item) => item.content ?? [])
			.find((content) => content.type === "output_text")?.text;

		if (typeof outputText !== "string") {
			throw new Error("OpenAI response did not contain output_text");
		}

		return {
			data: JSON.parse(outputText),
			metrics: {
				cachedInputTokens: responseBody.usage?.input_tokens_details?.cached_tokens ?? 0,
				cacheWriteTokens: responseBody.usage?.input_tokens_details?.cache_write_tokens ?? 0,
				inputTokens: responseBody.usage?.input_tokens ?? 0,
				latencyMilliseconds: performance.now() - startedAt,
				outputTokens: responseBody.usage?.output_tokens ?? 0,
				reasoningTokens: responseBody.usage?.output_tokens_details?.reasoning_tokens ?? 0,
				requests: 1,
			},
		};
	}
}

export function emptyMetrics() {
	return {
		cachedInputTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 0,
		latencyMilliseconds: 0,
		outputTokens: 0,
		reasoningTokens: 0,
		requests: 0,
	};
}

function publicizeRecipe(source, packageName) {
	return source
		.replace(/(["'])\.\.\/src\/lib\/scope\/([^"']+)\.js\1/g, `$1${packageName}/scope/$2$1`)
		.replace(/(["'])\.\.\/src\/exports\/Symbol\/([^"']+)\.js\1/g, `$1${packageName}/Symbol/$2$1`)
		.replace(/(["'])\.\.\/src\/exports\/([^"']+)\.js\1/g, `$1${packageName}/$2$1`)
		.replace(/(["'])\.\.\/src\/[^"']+\.js\1/g, `$1${packageName}$1`);
}

const packageRouteSchema = {
	additionalProperties: false,
	properties: {
		packages: { items: { type: "string" }, type: "array" },
		rationale: { type: "string" },
	},
	required: ["packages", "rationale"],
	type: "object",
};

const documentRouteSchema = {
	additionalProperties: false,
	properties: {
		documents: { items: { type: "string" }, type: "array" },
		rationale: { type: "string" },
	},
	required: ["documents", "rationale"],
	type: "object",
};

const solutionSchema = {
	additionalProperties: false,
	properties: {
		answer: { type: "string" },
		files: {
			items: {
				additionalProperties: false,
				properties: { content: { type: "string" }, path: { type: "string" } },
				required: ["path", "content"],
				type: "object",
			},
			type: "array",
		},
	},
	required: ["answer", "files"],
	type: "object",
};
