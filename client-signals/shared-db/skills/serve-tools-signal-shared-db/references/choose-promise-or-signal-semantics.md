# Choose Promise or Signal semantics

- Use `get`, `getAll`, `getAllKeys`, `has`, `count`, `add`, `put`, `delete`, or `clear` for one finite operation whose caller awaits completion.
- Use `watch` or `watchAll` when consumers must react to key, option, or post-commit database changes.
- Keep asynchronous query state explicit as `pending`, `ready`, or `error`.
  Do not hide loading and failure inside an undefined value.
- Let a watch key or option be a State or Computed only when changing it should refresh the query.
- Expect active queries for the same store to share one remote change subscription.
