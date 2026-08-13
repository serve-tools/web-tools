# Repository guidance

## Mission and layout

This repository hosts web platform tooling under the `@serve-tools` npm scope:

- `client/` for browser databases, storage, messaging, and other client runtime libraries.
- `client-signals/` for signal-aware browser databases, storage, and DOM libraries.
- `lit/` for Lit integrations.
- `polyfills/` for implementations that modify the global environment.
- `ponyfills/` for implementations imported without global modification.
- `signals/` for signal runtimes and signal-aware libraries.
- `vite/` for Vite plugins.

Each immediate child directory is an independently versioned npm workspace.

## Package metadata

Use `exports` as the sole public entrypoint map for modern packages.
Do not add top-level `main` or `types` fields.
Keep generated declarations beside their corresponding JavaScript files so TypeScript can infer them through `exports`.

## Source formatting

Use the configured formatters as the mechanical baseline: tabs for code and JSON, two spaces for YAML, double-quoted JavaScript and TypeScript strings, parenthesized arrow parameters, semicolons, trailing commas in multiline JavaScript and TypeScript constructs, and a 120-column target.
Do not hand-wrap code to a narrower column.

Use blank lines as semantic paragraph breaks.
Keep tightly related declarations and operations together, and separate distinct phases such as validation, setup, mutation, cleanup, and return.
Preserve intentional blank lines rather than collapsing code into a dense block.

For `if`, `for`, `for...of`, and `while`, omit braces only when the complete body is one short statement on the same line.
Use braces for bodies that span lines or contain multiple statements.
Prefer guard clauses, early returns, `continue`, and `break` when they keep the main path flat.

Prefer prefix `++value` and `--value` for counters and loop updates.
Use postfix only when an expression intentionally consumes the previous value.

Treat each JSDoc-documented declaration or member as an independent thought.
Leave an empty line immediately before every JSDoc block when it follows another declaration or statement.
A block at the beginning of a file or syntactic scope does not need a leading empty line.
Keep a concise JSDoc summary in a single-line block when it fits; use a multiline block for additional sentences, paragraphs, or tags.

Use semantic line breaks in authored Markdown prose: put each complete sentence on its own source line and do not wrap a sentence to a column width.
Keep headings, list markers, blockquote prefixes, tables, code fences, frontmatter, and standardized license text structurally intact.

## Required validation

Use Node.js 22.14+ and npm 11.5.1+.
Use the npm version pinned by `packageManager` when available.
For ordinary changes:

```shell
npm ci --ignore-scripts
npm run verify
```

Update JavaScript or TypeScript behavior, declarations, tests, and package documentation together.
When a public contract changes, update that package's consumer Skill under `skills/` as part of the same change.
Run `npm run check:skills` for Skill or package metadata changes.
Preserve unrelated changes, prefer native web APIs, and do not perform git, GitHub, or npm registry mutations without explicit authorization.
