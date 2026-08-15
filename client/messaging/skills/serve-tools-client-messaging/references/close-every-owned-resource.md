# Close every owned resource

- Unsubscribe active subscriptions before closing their client.
- Close the client or server to remove protocol listeners and notify the peer.
- Separately close an owned `MessagePort` or terminate an owned worker; protocol closure does not close the transport.
- Do not treat `closed` as crash detection.
  Add an application heartbeat if abrupt peer loss must be detected.
