# Observe an operation view

- Create the filtered or mapped `OperationView` and call `observeOperationView(view, initialValue?)` before `subscriber.consume(operation)`.
- Render the returned Signal directly in this package's signal-native `html` or `svg` template.
- Pass an initial value when the template should render something before the view emits; otherwise the Signal initially contains `undefined`.
- Create only the views that a component consumes instead of materializing the operation's complete lifecycle.
- Await `subscriber.consume(operation)` separately for the operation's terminal result or error.
- Dispose an `OperationViewSignal` to unsubscribe that view while retaining its current value.
- Dispose the subscriber to cancel an active operation and wait for producer cleanup.
