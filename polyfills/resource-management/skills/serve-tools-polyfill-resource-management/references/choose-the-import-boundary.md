# Choose the import boundary

- Import the package root for side effects when every missing resource-management global should be installed.
- Import an `./apply/*` subpath when only selected globals should be installed.
- Import the matching top-level subpath when code needs the native implementation if present or the fallback otherwise without changing globals.
- Use `@serve-tools/ponyfill-resource-management` only when intentionally adopting its module-scoped symbols and non-native protocol.
