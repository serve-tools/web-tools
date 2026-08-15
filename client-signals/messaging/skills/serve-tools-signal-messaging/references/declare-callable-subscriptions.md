# Declare callable subscriptions

- Declare each messaging subscription as a zero-parameter or one-parameter callable signature.
- Treat `Parameters<Signature>[0]` as the `observe()` input type when the signature has one parameter.
- Treat the signature's raw `ReturnType<Signature>` as the observed value without Promise unwrapping.
- Omit `requests` when the protocol declares only subscriptions.
- Name connected clients with the generic `Client<Protocol>` type, including worker-backed clients.
- Use callable protocol declarations and the generic `Client<Protocol>` resource type consistently.
- Treat protocol declarations as compile-time types only.
  Changing their notation does not change wire behavior.
