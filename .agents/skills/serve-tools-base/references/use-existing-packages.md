# Use existing platform packages

Do not import an Base Context, Drag, Drop, or Time class; the package does not duplicate these facilities.
Declare `@serve-tools/client-context` or `@serve-tools/client-input` as an application dependency when using it.

For context, create a typed key with `createContext()` and use `ContextProvider` or `ContextConsumer` from `@serve-tools/client-context`.
Keep the object in component-owned state.
Register its `disconnect()` cleanup with the Base connection before calling `connect()`.
For a subscribing consumer, call `refresh()` in the base element's `moved()` hook so a state-preserving move can select the current provider.
Ordinary removal and reconnection already run the connection lifecycle.
Bind received values through Signal DOM rather than rebuilding the component's layout.

For drag/drop, use native draggable elements and `observeDropTarget` from `@serve-tools/client-input/drop`.
Pass `{ signal: connection.signal }` so disconnection removes the observer and ends the active drag session.
Call `preventDefault()` on `dragover` only when the offered data is acceptable.
Read payload data from the terminal drop event, not from protected intermediate drag events.
Render dropped strings as text, never untrusted HTML.
Provide a keyboard-accessible action that achieves the same result when dragging is not available.
The observer coordinates session lifetime; it does not impose application acceptance, copying, moving, or propagation policy.

For time entry, use a named native `<input type="time">` with native `min`, `max`, `step`, and `required` constraints as needed.
The browser owns locale presentation while form values remain normalized strings.
Do not recreate the donor's fixed 12-hour contenteditable segments or fabricate a second form value.
