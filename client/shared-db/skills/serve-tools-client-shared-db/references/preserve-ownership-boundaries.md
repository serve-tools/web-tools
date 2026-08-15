# Preserve ownership boundaries

- Route every mutation that must enter the change feed through the shared client.
  Direct IndexedDB writes bypass it.
- Give the port exclusively to this protocol.
- Close subscriptions and the client, then separately close the page-owned port.
- Add an application heartbeat if destroyed-tab detection matters.
