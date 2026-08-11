# Repository guidance

## Mission and layout

This repository hosts web platform tooling under the `@serve-tools` npm scope:

- `client/` for browser databases, storage, messaging, and other client runtime libraries.
- `polyfill/` for implementations that modify the global environment.
- `ponyfill/` for implementations imported without global modification.
- `vite/` for Vite plugins.

Each immediate child directory is an independently versioned npm workspace.

## Package metadata

Use `exports` as the sole public entrypoint map for modern packages. Do not add
top-level `main` or `types` fields. Keep generated declarations beside their
corresponding JavaScript files so TypeScript can infer them through `exports`.

## Source formatting

Treat each JSDoc-documented declaration or member as an independent thought.
Leave an empty line immediately before every JSDoc block when it follows another
declaration or statement. A block at the beginning of a file or syntactic scope
does not need a leading empty line.

## Required validation

Use Node.js 22.14+ and npm 11.5.1+. Use the npm version pinned by
`packageManager` when available. For ordinary changes:

```sh
npm ci --ignore-scripts
npm run verify
```

Update JavaScript or TypeScript behavior, declarations, tests, and package
documentation together. Preserve unrelated changes, prefer native web APIs,
and do not perform git, GitHub, or npm registry mutations without explicit
authorization.
