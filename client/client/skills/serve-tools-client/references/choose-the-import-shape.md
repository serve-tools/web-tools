# Choose the import shape

- Import named namespaces such as `context`, `keyboard`, or `storage` from `@serve-tools/client` when one module coordinates several client capabilities.
- Import `@serve-tools/client/context`, `@serve-tools/client/keyboard`, or another focused subpath when only one capability is needed.
- Do not expect a flat root API; the root intentionally preserves capability ownership through namespaces.
