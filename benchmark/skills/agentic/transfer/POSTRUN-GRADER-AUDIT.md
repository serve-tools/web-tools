# Post-run exploratory grader fairness audit

## Scope and status

This is a prompt-semantic review requested after the frozen run.
It examined only the three named task prompts, their frozen golden and hidden checks, and the canonical router source.
It did not inspect recipes, conditions, learner artifacts, grades, or outcomes.
The findings are exploratory and must not replace the preregistered grade or endpoint.

Reviewed SHA-256 sources:

| Source                                         | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `tasks.mjs`                                    | `b2772d374f6ec6ec1114a14b2f18e663e47075ed13cf269f5bfe47b2715d55d1` |
| `tasks/preference-handler/hidden.mjs`          | `3830c5b63a55b72d0453a4e69f8e484dffd4c41f2626bf88a2bfaf2253dbfcdb` |
| `tasks/preference-handler/solution.fixture.ts` | `37fc73f1bf9ff701262a488699eee193603a28f200cee47308f17a78fc521273` |
| `tasks/page-operation/hidden.mjs`              | `37435ae0265d5c5c518cbe45fac4f726df349be7dd9855b5a8a54c7fd0270ef3` |
| `tasks/page-operation/solution.fixture.ts`     | `3ca94e19d44a88c9b3479a829416e94e24993077cb3c95d07384fb31a1dd490e` |
| `tasks/workspace-links/hidden.mjs`             | `df9d30664366c5c95afb5c0e26bf5649bb404c708ba8da477b1993ecfd0873a3` |
| `tasks/workspace-links/solution.fixture.ts`    | `b37837f389d1fdb2381dacc1fdc9e0bf11cdf9ecf4e94364ce98139eb6001df4` |
| `core/router/src/router.ts`                    | `99c10ab16a126ccf5d4fe6f3bd303067ee9c6d938b662378a872c770ab0033d9` |

## Findings

### Preference-handler initial-record extra key: fairness defect

The prompt reserves exact-object wording for PATCH: “PATCH accepts exactly `{ value: string | null }`.”
For initial state, it instead says “Clone and validate initial `{ userId, key, value }` records.”
The hidden check requires a `TypeError` for `{ userId: 1, key: "theme", value: null, extra: true }`, and the golden enforces exactly three own keys.
That adds an undisclosed exact-shape restriction to initial records.
A solution that validates the declared fields, clones their values, and ignores unrelated properties satisfies the stated initial-record contract but fails this hidden case.

Minimal future correction: remove that extra-key case from the initial-input rejection table and retain invalid required-field/value cases.
Alternatively, amend the task prompt before a future freeze to say initial records must have exactly those three own properties.
The former better matches the existing prompt and the distinction it intentionally makes for PATCH bodies.

### Page-operation synchronous validation: fairness defect

The prompt expressly allows synchronous validation found by the executor to surface through `iteration/result`.
Nevertheless, the hidden check requires synchronous `assert.throws` for invalid `load`, `pages`, and primitive `options` arguments.
This rejects a legitimate owned-operation implementation that starts immediately, performs validation in its executor, and reports the `TypeError` through `result` or iteration exactly as the prompt permits.

Minimal future correction: use an oracle that accepts either synchronous `TypeError` or a returned operation whose `result` rejects with `TypeError`.
For each case, construct the operation inside a try block; if construction returns, await a bounded `result` rejection and then `finished`.
Keep the existing semantic validation assertions, but remove the delivery-timing requirement.

### Workspace-links FTP URL: no score-changing fairness defect

The wording “absolute URL” is broader than HTTP(S) in ordinary URL terminology, so a future prompt should explicitly say “HTTP(S) absolute URL” if that is intended.
However, this task also requires typed reversible routes for matching, and the canonical `@serve-tools/router` `route.match()` implementation constructs a URL then deliberately returns `null` unless its protocol matches `https?`.
The hidden FTP assertion therefore observes the required package capability’s documented runtime contract rather than an independently invented restriction.
An adapter built through the required route matcher rejects that URL.

No rescore or grader change is warranted for this case alone.
For a future task, clarify the protocol in the prompt and requirement matrix so it is not left to package-source inference.

## Corrected exploratory probes

Reviewed the post-run-only correction sources:

| Source              | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `postrun.mjs`       | `cf8223f8d9839cb5513cc76cbad3ab80c9e76eef2e95612054714b53b0a35706` |
| `postrun-tests.mjs` | `b28fc4c99e036d667ec3c2c25afb72b4bdb63a444c339730a3fe469971a58401` |

Accepted.
The fairness variant removes only the undisclosed initial-record extra-key negative case.
For all two public and six hidden synchronous page-validation assertions, it accepts either a synchronous `TypeError` or a returned operation whose `result` rejects with `TypeError` within 500 milliseconds and whose `finished` then settles.
That exactly accommodates the two delivery forms allowed by the prompt while retaining the invalid-input requirement.

The quality variant adds positive-ID inspection probes and verifies that solution import preserves the complete `globalThis.URLPattern` property descriptor.
It observes the descriptor without deleting, replacing, or otherwise withholding the native global that the router requires.
The golden passes these probes and a missing-positive-ID-validation mutant fails them.

`node --test benchmark/skills/agentic/transfer/postrun-tests.mjs` passed both focused tests.

## Consequence

The initial-record exact-shape and synchronous-validation findings are material post-run grader defects.
They should be reported as exploratory quality limitations and should prevent a positive confirmatory adoption claim until a fresh independently frozen evaluation uses corrected or explicitly disclosed requirements.
