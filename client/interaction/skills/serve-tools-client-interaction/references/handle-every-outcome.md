# Handle every outcome

- Switch on `InteractionResult.status`.
- Treat `completed` as the only confirmed success and read its `value`.
- Treat `aborted` as expected non-completion, not success or failure.
  Web Share can also use this state when no share targets exist, and native file pickers may use it when an entry cannot be exposed.
- Treat `failed` as unsupported capability, missing activation, denied permission, invalid input, or another failure.
  Narrow `error` from `unknown` without assuming every rejection is a `DOMException`.
