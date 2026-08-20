import type { FinishReason, fingerprintTools, LanguageModelUsage, TextStreamPart, UIMessage } from "ai";
import { readUIMessageStream, simulateReadableStream, streamText, toUIMessageStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, test } from "vitest";

import { AsyncOperation } from "../src/operation.js";

type Toolset = Parameters<typeof fingerprintTools>[0];

const model = new MockLanguageModelV3({
	doStream: async () => ({
		stream: simulateReadableStream({
			chunks: [
				{ type: "text-start", id: "text-1" },
				{ type: "text-delta", id: "text-1", delta: "Hello" },
				{ type: "text-delta", id: "text-1", delta: ", robot!" },
				{ type: "text-end", id: "text-1" },
				{
					type: "finish",
					finishReason: { unified: "stop", raw: undefined },
					logprobs: undefined,
					usage: {
						inputTokens: {
							total: 4,
							noCache: 4,
							cacheRead: undefined,
							cacheWrite: undefined,
						},
						outputTokens: {
							total: 3,
							text: 3,
							reasoning: undefined,
						},
					},
				},
			],
		}),
	}),
});

const generateRobotStory = (): AsyncOperation<UIMessage, UIMessage | undefined> => {
	return new AsyncOperation<UIMessage, UIMessage | undefined>(async (write, { signal }) => {
		const result = streamText({
			model,
			prompt: "Ignored deterministic test prompt",
			abortSignal: signal,
		});

		let finalMessage: UIMessage | undefined;

		for await (const message of readUIMessageStream({
			stream: toUIMessageStream({ stream: result.stream }),
		})) {
			finalMessage = message;

			await write(message);
		}

		return finalMessage;
	});
};

describe("AI SDK adapter with streaming", () => {
	test("delivers streamed parts and terminal metadata", async () => {
		const prompt = "Ignored deterministic test prompt";

		type ChatVerdict = {
			finishReason: FinishReason;
			usage: LanguageModelUsage;
		};

		await using connection = new AsyncOperation<TextStreamPart<Toolset>, ChatVerdict>(async (write, { signal }) => {
			const result = streamText({
				model,
				prompt,
				abortSignal: signal,
			});

			for await (const part of result.stream) {
				await write(part);
			}

			return { finishReason: await result.finishReason, usage: await result.usage };
		});

		const parts: TextStreamPart<Toolset>[] = [];

		for await (const part of connection) {
			parts.push(part);
		}

		const verdict = await connection.result;

		expect(parts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "text-delta", text: "Hello" }),
				expect.objectContaining({ type: "text-delta", text: ", robot!" }),
			]),
		);
		expect(verdict.finishReason).toBe("stop");
		expect(verdict.usage).toMatchObject({ inputTokens: 4, outputTokens: 3, totalTokens: 7 });
	});
});

describe("AI SDK adapter", () => {
	test("delivers progressive UIMessage snapshots and the final message", async () => {
		const operation = generateRobotStory();
		const snapshots: UIMessage[] = [];

		for await (const message of operation) {
			snapshots.push(message);
		}

		const finalMessage = await operation.result;

		expect(snapshots.length).toBeGreaterThan(1);
		expect(finalMessage).toBe(snapshots.at(-1));
		expect(finalMessage?.parts).toContainEqual({ type: "text", text: "Hello, robot!", state: "done" });
	});
});
