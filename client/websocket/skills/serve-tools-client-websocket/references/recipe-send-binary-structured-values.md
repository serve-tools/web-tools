# Recipe: send binary structured values

```ts
interface AssetProtocol {
	requests: {
		storeAsset: (input: { name: string; bytes: Uint8Array }) => { id: string };
	};
}

await using assets = await connect<AssetProtocol>("wss://example.com/assets");
const stored = await assets.request("storeAsset", { name: "preview.webp", bytes });
```

The serializer preserves cycles, aliases, sparse arrays, maps, sets, dates, errors, buffers, data views, and typed-array backing relationships.
Functions, symbols, weak collections, `SharedArrayBuffer`, and unsupported host objects fail with `DataCloneError`.
There is no transfer list or custom codec, and WebSocket transmission copies binary bytes.
Each request or event is encoded as one complete value; use another protocol when uploads require streaming, chunk progress, resumability, or backpressure.
