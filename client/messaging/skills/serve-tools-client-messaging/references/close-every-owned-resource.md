# Close every owned resource

- Unsubscribe active subscriptions before closing their client.
- Close the client or server to remove protocol listeners and notify the peer.
- Separately close an owned `MessagePort` or terminate an owned worker; protocol closure does not close the transport.
- Expect the server to finish automatically when a client is destroyed abruptly, such as a crashed or discarded tab.
  Where Web Locks can be acquired, the client announces its lease only after holding it; the browser releases it on agent destruction, and the server finishes when the lock is released.
- When both peers expose Web Locks, keep them in the same Web Locks storage bucket, normally same-origin windows and workers in the same storage partition.
  Cross-origin or separately partitioned transferred ports are not supported by the lease protocol.
- Do not add application delays for lease setup: `client.ready` and operations do not wait for lock acquisition.
  Automatic abrupt-peer detection starts only after the lease is announced.
  Closing cancels pending acquisition, releases a held lease, and prevents late lease announcements or protocol events from reopening the client.
- Expect a window client to close itself on `pagehide` so the page stays back/forward-cache eligible; close its owned port, then create a fresh worker connection and re-subscribe from a `pageshow` listener when `event.persisted` is `true`.
  Do not reuse the old port after protocol closure: its serving peer has removed that connection's listener.
  Chrome currently declines to cache pages connected to a `SharedWorker` regardless of locks; that constraint is independent of this library.
