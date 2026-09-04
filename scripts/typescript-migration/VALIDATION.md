# Compiler preparation validation

Validated September 4, 2026, on macOS arm64 with Node 24.16.0 and Rolldown 1.2.7.
These results apply to the fixture and compiler versions listed here.
They do not establish repository migration readiness, Vite HMR, watcher portability, or performance.

Probe source SHA-256: `8e9019aabe6331f87ac3394e9cfbc7eb1911dad8e9b87fe4f96df6b5f6ad1449`.

| Check                             | TypeScript 7.0.2          | TypeScript 7.1.0-dev.20260904.1 |
| --------------------------------- | ------------------------- | ------------------------------- |
| `compiler-version`                | passed                    | passed                          |
| `async/valid`                     | passed                    | passed                          |
| `sync/valid`                      | passed                    | passed                          |
| `async/semantic-error`            | passed                    | passed                          |
| `sync/semantic-error`             | passed                    | passed                          |
| `async/syntax-error`              | passed                    | passed                          |
| `sync/syntax-error`               | passed                    | passed                          |
| `async/declaration-error`         | passed                    | passed                          |
| `sync/declaration-error`          | passed                    | passed                          |
| `async/config-error`              | passed                    | passed                          |
| `sync/config-error`               | passed                    | passed                          |
| `clean-memory-bundle`             | Not run: emit unavailable | passed                          |
| `disk-memory-parity`              | Not run: emit unavailable | passed                          |
| `transitive-edit-with-stale-dist` | Not run: emit unavailable | passed                          |
| `edit-error-recovery`             | Not run: emit unavailable | passed                          |
| `file-create-delete`              | Not run: emit unavailable | passed                          |
| `session-disposal`                | passed                    | passed                          |
| `fixture-cleanup`                 | passed                    | passed                          |

The 7.0.2 run reports the adapter as unsupported because `Program.emitToString` is unavailable.
The regression test also confirms that requiring adapter support produces a failed result for that compiler.
The candidate run requires adapter support and passes every listed check.

The candidate fixture executes results of 10 initially, 50 after a transitive change while physical output still produces 10, and 82 after error recovery.
All nine expected JavaScript, declaration, and source-map files are present and initially match the same compiler's CLI output byte for byte.

Run the commands in [README.md](README.md) to refresh these results against a selected compiler.

Preparation-tool tests pass: two inventory cases and one installed-compiler regression case.
An isolated export of the repository's committed source plus these tools passed `npm ci --ignore-scripts`, `npm run build`, and `npm run verify` using TypeScript 7.0.2.
That validation kept concurrent work and dependencies in the shared checkout untouched.
