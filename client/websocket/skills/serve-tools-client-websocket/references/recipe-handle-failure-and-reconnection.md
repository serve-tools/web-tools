# Recipe: handle failure and reconnection

Catch operation failures where the application can distinguish cancellation, remote rejection, and connection loss.
Use `RemoteError` for a server-returned failure and provide subscription `onError` when recovery is local.
If reconnecting, create a new client and let application policy own delays, retry limits, authentication refresh, shutdown, and safe operation recreation.
Transport and protocol closures reject active requests with ordinary connection errors; they do not prove whether the server committed an operation before disconnecting.
Await `client.closed` when cleanup ordering matters, but a replacement connection does not otherwise depend on that promise.
