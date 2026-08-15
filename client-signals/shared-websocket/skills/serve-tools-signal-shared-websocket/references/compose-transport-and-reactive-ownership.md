# Compose transport and reactive ownership

The shared worker owns the physical WebSocket, each page owns its shared client, and each UI consumer owns its observation.
Dispose observations before closing their page client.
Closing one page client leaves the worker transport available to other pages.
