# Recipe: quick start

This public-import example is generated from the compile-checked `test/realtime-protocol.recipes.ts` fixture in the package source.

```ts
import { deserialize, isClientMessage, serialize } from "@serve-tools/realtime-protocol";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";

/** A compile-tested structured value, protocol guard, and reliable-stream framing recipe. */
export function realtimeProtocolRecipe(value: unknown): unknown[] {
	const frame = encodeFrame(serialize(value));
	const decoder = new FrameDecoder();

	return decoder
		.push(frame)
		.map((payload) => deserialize(payload, { maximumArrayBufferLength: 16 * 1024 * 1024 }))
		.filter(isClientMessage);
}
```
