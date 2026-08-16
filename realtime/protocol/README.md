# @serve-tools/realtime-protocol

`@serve-tools/realtime-protocol` defines the shared binary wire contract used by the Serve Tools realtime clients and servers.
It provides structured-value serialization, versioned request and subscription message guards, protocol types, and optional framing for reliable byte streams.

Most applications should use [`@serve-tools/client-websocket`](../../client/websocket/) and [`@serve-tools/server-websocket`](../../server/websocket/) instead.
Use this package directly when implementing a transport adapter, protocol diagnostic, or future WebTransport integration.

## Install

```shell
npm install @serve-tools/realtime-protocol
```

## Encode and validate a message

```ts
import { deserialize, isClientMessage, protocol, serialize } from "@serve-tools/realtime-protocol";

const bytes = serialize([protocol, "request", 1, "getRoom", { id: "lobby" }]);
const value = deserialize(bytes);

if (!isClientMessage(value)) {
	throw new TypeError("Invalid client message");
}
```

`serialize()` preserves structured JavaScript values including cycles, shared references, maps, sets, errors, dates, regular expressions, `ArrayBuffer`, `DataView`, and typed arrays.
Unsupported values such as functions, symbols, weak collections, `SharedArrayBuffer`, and unknown host objects throw `DataCloneError`.

`deserialize()` reconstructs data produced by the matching serializer.
Treat its output as untrusted until a message guard and any application-specific value validation have succeeded.

## Frame a reliable byte stream

WebSocket messages already preserve boundaries and do not need additional framing.
Reliable streams such as WebTransport bidirectional streams do need explicit message boundaries.

```ts
import { deserialize, serialize } from "@serve-tools/realtime-protocol";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";

const outgoing = encodeFrame(serialize({ ready: true }));
const decoder = new FrameDecoder();

for (const payload of decoder.push(outgoing)) {
	console.log(deserialize(payload));
}
```

`encodeFrame()` writes a four-byte unsigned big-endian payload length followed by a copied payload.
`FrameDecoder` accepts partial or coalesced chunks and returns owned `ArrayBuffer` payloads.
Call `finish()` at stream EOF to reject a truncated final frame.
Its default maximum frame length is 16 MiB; set an explicit lower limit at trust boundaries when possible.

This framing is the common foundation prepared for WebTransport packages.
It does not select streams, define session authentication, add retransmission, or turn unreliable datagrams into reliable protocol messages.

## Wire contract

Every message is a tuple beginning with the exported `protocol` constant.
Clients send `request`, `subscribe`, `cancel`, and `close` messages.
Servers send `resolve`, `reject`, `event`, `complete`, and `close` messages.

Operation IDs are non-negative safe integers and are scoped to one connection.
Error messages use `ErrorRecord`, whose stable fields are `name`, `message`, and an optional `stack`.
Applications should avoid exposing sensitive stacks across trust boundaries.

The guards validate message envelopes only.
They do not validate request inputs, response values, event values, authorization, operation ordering, or resource limits.

## Public API

The root export provides:

- `serialize(value)` and `deserialize(payload)` for structured binary values;
- `protocol`, `isClientMessage()`, `isServerMessage()`, and `isErrorRecord()` for the versioned envelope;
- protocol, operation, message, and error record types shared by clients and servers.

The `@serve-tools/realtime-protocol/stream` export provides `encodeFrame()`, `FrameDecoder`, and `defaultMaximumFrameLength`.

## Compatibility

The package targets modern JavaScript runtimes with `ArrayBuffer`, typed arrays, `DataView`, `TextEncoder`, and `TextDecoder`.
The serializer is tested in Node.js and real browsers.
The stream framing API is runtime-neutral and does not depend on WebSocket or WebTransport globals.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-realtime-protocol`](./skills/serve-tools-realtime-protocol/SKILL.md).
Install or link that directory when an agent needs wire-contract, serializer, adapter, or reliable-stream framing guidance.

## Development

```shell
npm ci --ignore-scripts
npm run verify
```

The public recipe is compile-checked in [`test/realtime-protocol.recipes.ts`](./test/realtime-protocol.recipes.ts).

Run the serializer benchmark with:

```shell
npm run benchmark --workspace @serve-tools/realtime-protocol
```

## License

[MIT-0](./LICENSE.md)
