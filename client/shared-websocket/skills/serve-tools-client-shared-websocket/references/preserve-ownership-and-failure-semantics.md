# Preserve ownership and failure semantics

Create the physical connection with `listen()` in a shared worker and attach each page with `connect(worker.port)`.
Closing a page client must not be treated as closing the physical socket; close the worker server when the shared transport should end.
Requests and subscriptions retain the direct WebSocket client's cancellation and remote-failure semantics.
Model reconnection and replay explicitly because neither variant performs them automatically.
