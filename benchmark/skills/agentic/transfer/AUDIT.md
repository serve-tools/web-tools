# Independent pre-freeze task and grader audit

## Scope

Reviewed only the disclosed transfer task prompts and requirement matrices, golden fixtures, public smoke checks, hidden checks, task-mutant program, protocol, shared grading/runtime/tool implementation, and the relevant public package APIs and declarations.
Recipe material, conditions, condition results, prior learner artifacts, and external network sources were not opened.

The review covered all eight task families: `workspace-links`, `page-operation`, `preference-handler`, `reactive-cart`, `blob-channel`, `binary-packet`, `resource-lease`, and `switchable-projection`.

## Frozen source hashes

SHA-256 at audit time:

| Source                 | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `PROTOCOL.md`          | `51bd789bb1e77a2bce039d2aa005cbf37cfea9cc90fec61df3c2eac24868259d` |
| `tasks.mjs`            | `b2772d374f6ec6ec1114a14b2f18e663e47075ed13cf269f5bfe47b2715d55d1` |
| `task-tests.mjs`       | `53691951310d9205713c62fa4cf5727cf26d2fa0d3b6538f1843770b9ebda05f` |
| `../grading.mjs`       | `725b162ee242983be55aee7eb1c2a5c9576674b2cd0bf258c003cd960d5c2c78` |
| `../runtime.mjs`       | `13fa870b3f26c60b3aa50f715a768bd383b89ec4caee075503d6c0c16cdf8968` |
| `../tools.mjs`         | `4dc63f2cba59fc0d0eff052033194adbb565157551a672c31888bec0ed48e978` |
| `../tasks/_shared.mjs` | `44a0a547c10451b0064810894fe2d828a9c31ab5e9bd2f0c65bfb7881ff1faac` |

| Task artifacts, ordered `fixture / smoke / hidden` | SHA-256                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `binary-packet`                                    | `b9df6f0fa52bd17b7f8a831638e3c9a56c1134101012349a56016517893ee17e` / `c8ffa033ba54b8325ac25f9eb934536d467f2653381c85ec9a57c72d7973057e` / `f00aa0c9beecb135e4b4e9d713a48aaa497b1492fdd6712b408e829bb2bc1a01` |
| `blob-channel`                                     | `5c9681e76a65fe49b6ff2b4e1e84522b3139c3a656e0e8350bb6641c249c7a70` / `297356d8abc8bef90e1162da6069ac86ca250fbdeebd11d50420c69e686ae945` / `06c5f41840ed2bccb0ccbf4154f22f42364afe509417b34c0797d2d137eff8cc` |
| `page-operation`                                   | `3ca94e19d44a88c9b3479a829416e94e24993077cb3c95d07384fb31a1dd490e` / `5495515673330bc2eacfa917935bcdeebe96f43293e1a278a19ff25d5a3808e3` / `37435ae0265d5c5c518cbe45fac4f726df349be7dd9855b5a8a54c7fd0270ef3` |
| `preference-handler`                               | `37fc73f1bf9ff701262a488699eee193603a28f200cee47308f17a78fc521273` / `7201101171844e70375b9c105850dcee01a136daf688fab0d5731fd82b902e07` / `3830c5b63a55b72d0453a4e69f8e484dffd4c41f2626bf88a2bfaf2253dbfcdb` |
| `reactive-cart`                                    | `93db52e0384e56928e15afd42703c52a3d76c2b4222c166bfd377c00934ba9e5` / `bb87589ca7252319162d9b4614e4f46b025c83e8197bb39949bc701c163ad3f5` / `3225754658ecc8cc061d24a2fb3cf3a534d56810697ed11fcee2d48acfe60362` |
| `resource-lease`                                   | `828983f0d6ab73590d178be8b1419c34eea14fbcf19bd6ccfecf33a0e51d55db` / `c5e30def00fb82b122a265897725f4ae4ae57a7cebbe41ddb3a9bfbc7addf3ea` / `d5f9bed2e544821f3da0849aae5616c49250b2e1e5e8db25fb9eb72fc8a4bf15` |
| `switchable-projection`                            | `0816be1fce43a236698e918d2b9210186c8bf11894aee15b3590e01232300d8a` / `b8934c0d62a698bd81311a7cfad897e24b6f49b166e891d8497dd6392fab75af` / `4762b8ccec5e65d0ff88a3d3845f01b54be7e11d9faf92356c3c6dbb4b18eca3` |
| `workspace-links`                                  | `b37837f389d1fdb2381dacc1fdc9e0bf11cdf9ecf4e94364ce98139eb6001df4` / `a04adabc9e359246e3995a27e3082d06db1693c03a37e78ab9be9467f77342bb` / `df9d30664366c5c95afb5c0e26bf5649bb404c708ba8da477b1993ecfd0873a3` |

## Findings and resolutions

| Finding                                                                                                                                    | Resolution                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page-operation validation, zero-capacity backpressure, and cancellation cleanup were incompletely observed.                                | Hidden checks now cover invalid callback/iterable/options inputs, explicit zero capacity, upstream/manual/iterator/disposal cancellation, exact abort reason, no late output, and cleanup before `finished` settles.    |
| HTTP byte-limit behavior and mutable returned data were under-observed.                                                                    | Hidden checks now distinguish UTF-8 byte boundaries and mutate a returned JSON object before confirming stored state is unaffected.                                                                                     |
| Reactive-cart publication isolation and input validation were under-observed; its golden imposed an undisclosed exact-own-key restriction. | Hidden checks mutate published snapshots and lines, cover non-iterable initial input, callback validation, and non-string setter ids. The golden now validates required fields without rejecting additional properties. |
| Blob transfer ownership, sparse initial input, fresh read buffers, and post-close request termination were under-observed.                 | Hidden checks cover each behavior, including bounded rejection of both `get` and `put` after close and independent subscriber payloads.                                                                                 |
| Packet decoding lacked non-string and valid-looking noncanonical spelling coverage.                                                        | Hidden checks cover those inputs and preserve selected-view, Buffer, subclass, size, wire, and output-isolation cases.                                                                                                  |
| Resource-lease rollback did not exercise invalid callbacks after registrations or asynchronous acquisition failure.                        | Hidden checks now require cleanup in both cases, in addition to package-symbol use, reverse order, identity, and nested suppression checks.                                                                             |
| Switchable-projection lacked setter atomicity, effective-change, and published-array isolation observations.                               | Hidden checks now cover invalid setters without mutation, same-value no-op behavior, and mutation of a published array.                                                                                                 |
| Mutant checking accepted a catalog where critical matrix rows could have no mutation mapping.                                              | The matrix test now requires a nonempty mapping for every critical row, and verifies 2–4 compiling, smoke-passing semantic mutants per task. All declared mutants are rejected by hidden checks.                        |

## Verification

Independent offline execution completed:

```shell
node --test benchmark/skills/agentic/transfer/task-tests.mjs
```

All three subtests passed: matrix integrity, every golden fixture through compilation/import contract/public/hidden checks, and every declared compiling smoke-passing semantic mutant rejected by hidden checks.

## Remaining limits

The suite samples contract behavior and semantic regressions; it does not prove every possible implementation or future consumer integration.
The workspace-link boundary table covers every declared nullable board field and selected non-round-trippable path cases, rather than every field/value combination.
Noncritical matrix rows such as the HTTP adapter and route boundary rows rely on direct behavior checks and package-import contract checks without their own uniquely mapped mutant.
MessagePort cleanup is inferred from observable request rejection, peer closure, subscription termination, and package lifecycle behavior; the grader does not inspect private port state.

Decision: ready.
