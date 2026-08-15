# Handle failures

Expect unknown operations, handler failures, and serialization failures to reject requests.
Handle subscription termination with `onError` and `onComplete`.
Preserve `RemoteError` as the representation of a thrown remote error.
