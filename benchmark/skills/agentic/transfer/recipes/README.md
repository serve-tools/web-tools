# Transfer recipes

These task-blind files are short consumer scaffolds for public `@serve-tools` package capabilities.
Copy exactly one `.ts` file into the candidate solution, keep useful helpers, and replace its final adapter marker with application-specific code.
The manifest describes discovery triggers and names stable helper exports for reuse diagnostics; copying or retaining them is never a correctness requirement.

| Recipe                         | Use it for                                             | Invariants retained by the scaffold                                                                                         |
| ------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `router.ts`                    | Reversible typed URL declarations and ordered matching | Canonical safe integers, route-owned serialization, explicit defaults, repeated query values, first-match route order       |
| `async-operation.ts`           | Owned progress streams with a terminal result          | Awaited writes, finite bounded capacity, cooperative abort, concurrent draining before awaiting the result                  |
| `http-contract-router.ts`      | Trusted JSON validation and Fetch handling             | Router/contract path identity, Standard Schema validation, status-discriminated bodies, `null` only for bodyless responses  |
| `signal-collections-effect.ts` | Reactive native collections with validated input       | Dense arrays, finite numeric values, validation before mutation, computed reads, disposable effects                         |
| `client-messaging.ts`          | Typed worker or port protocols                         | One protocol owner per endpoint, transfer-list ownership, abortable operations, subscription cleanup, explicit port closure |
| `arraybuffer-base64-node.ts`   | Node-only base64 encoding                              | Undefined-only option defaults, rejected explicit `null`, valid alphabets, selected view offset and length                  |
| `resource-management.ts`       | Mixed asynchronous resource lifetimes                  | Package-local symbol identity, LIFO cleanup, acquisition/work error retention, nested cleanup suppression                   |
| `dormant-signal-effects.ts`    | Effects that must be wired before starting             | Dormant construction, synchronous first run, microtask batching, disabled publication, skipped disposed work                |

The recipes depend on installed workspace packages and do not include alternate implementations of those runtimes.
The router recipe's custom schema codec is intentionally generic-router-only metadata; use `serialization: "href"` if adapting it into an HTTP contract, while the HTTP recipe uses native integer metadata directly.
Run their independent compile/runtime checks with:

```shell
node --test benchmark/skills/agentic/transfer/recipe-tests.mjs
```
