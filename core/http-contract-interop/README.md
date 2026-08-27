# HTTP contract OpenAPI interoperability fixture

This private workspace checks the public, built `@serve-tools/http-contract` exports against pinned `openapi-typescript` and `openapi-fetch` versions.
Its dependencies do not become production dependencies of the HTTP package.

```shell
npm run build --workspace @serve-tools/http-contract
npm test --workspace @serve-tools/http-contract-interop
```

The tests regenerate and compare the checked-in declarations, compile positive and negative generated-client examples, and send a generated-client request with path, repeated query, and JSON-body inputs through `createHandler()`.
The fixture explicitly invokes its local TypeScript 5 compiler because the generator currently requires the classic compiler API; repository builds continue to use the pinned native TypeScript 7 compiler.
The native repository test suite runs this fixture as part of `npm run verify`.
