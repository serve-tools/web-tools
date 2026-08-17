# Choose root or focused imports

Import the root package when an application boundary deliberately groups several signal-aware client capabilities.
Use focused subpaths such as `@serve-tools/client-signals/websocket` when only one adapter is required.
Each realtime entrypoint includes both the client operations and its Signal observation API.
Messaging and shared transports retain matching environment-specific subpaths beneath their focused entrypoint.
The namespace package re-exports contracts and does not replace the lifecycle guidance of each focused package.
