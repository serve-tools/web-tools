# Preserve server boundaries

Authenticate during the upgrade and return a `Response` to reject it.
Authorize individual operations when connection identity alone is insufficient.
Validate every untrusted input at runtime; TypeScript protocol declarations are compile-time only.
Set message, send-queue, and active-operation limits appropriate to the service.
Keep the default stack-redacted error formatter unless specific fields are safe to expose.
Close adapter-owned connections during shutdown and report asynchronous cleanup failures.
