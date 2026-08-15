# Retain inferred protocols

Use `ProtocolType<Value>` to extract the protocol branded onto a `Client`, `Server`, or `Listener`.
It also extracts through promise-wrapped branded values.
When the worker owns an inline declaration, export `ProtocolType<typeof listener>` and import that exported type on the window side.

```ts
type ClientProtocol = ProtocolType<typeof client>;
type ServerProtocol = ProtocolType<typeof server>;
type ListenerProtocol = ProtocolType<typeof listener>;
type PendingProtocol = ProtocolType<Promise<typeof client>>;
```
