---
name: serve-tools-http-contract
description: Use @serve-tools/http-contract for APIs.
---

# Use @serve-tools/http-contract

Treat the installed package README and public declarations as the API source of truth.
Read only the reference needed for the current task.

## Route by task

- [Recipe: declare and call an API](references/recipe-quick-start.md): a type-checked contract and native Fetch client.
- Keep validators and the executable contract in trusted server modules; browser clients import the contract only with `import type`.
- Keep `@serve-tools/router` responsible for route declarations, pathname/search typing, and trusted matching.
- Use `serialization: "href"` with a safe route module for custom router codecs; use `"native"` only for built-in reversible wire forms.
- To preserve ownership and public-wire boundaries, read [Preserve HTTP contract boundaries](references/preserve-contract-boundaries.md).
