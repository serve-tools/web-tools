# Use the platform-shaped contract

1. Define a string-keyed schema and construct `Storage<Schema>` for local storage or pass `"session"` for session storage.
2. Keep values as strings.
   The schema narrows keys and string values; it does not serialize application objects.
3. Use `get`, `has`, `set`, `delete`, `clear`, and `size` for collection-style access.
4. Use `subscribe` when every change occurrence matters.
