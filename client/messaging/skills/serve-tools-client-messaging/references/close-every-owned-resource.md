# Close every owned resource

- Unsubscribe active subscriptions before closing their client.
- Close the client or server to remove protocol listeners and notify the peer.
- Separately close an owned `MessagePort` or terminate an owned worker; protocol closure does not close the transport.
- Expect the server to finish automatically when a client is destroyed abruptly, such as a crashed or discarded tab.
  Every client holds an announced Web Lock that the browser releases on agent destruction, and the server finishes when the lock is released.
- Expect a window client to close itself on `pagehide` so the page stays back/forward-cache eligible; reconnect and re-subscribe from a `pageshow` listener when `event.persisted` is `true`.
  Chrome currently declines to cache pages connected to a `SharedWorker` regardless of locks; that constraint is independent of this library.
