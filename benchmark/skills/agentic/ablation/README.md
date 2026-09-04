# Optional helper evaluation

This follow-up separates the effect of short instructions from the effect of optional reusable source.
The frozen primary comparison is `helpers` versus `minimal`: those conditions have identical guidance, and only `helpers` includes twelve small source files.
`docs` and `current` provide context for the existing approaches.

[RESULTS.md](./RESULTS.md) reports the completed 192 attempts: optional helpers did not demonstrate savings.
Independent review found material grader defects after measurement; the original scores remain preserved and corrected saved-artifact scores are exploratory.
[POSTRUN-GRADER-AUDIT.md](./POSTRUN-GRADER-AUDIT.md) documents those defects and the approved corrections.

[PROTOCOL.md](./PROTOCOL.md) defines the 192-attempt allocation, accounting rules, uncertainty calculation, and acceptance criteria before measurement.
[GRADER-AUDIT.md](./GRADER-AUDIT.md) records the independent review of task requirements and checks.
No measured run may start until both independent positive implementations and the deliberate behavior mutations validate every task.
The commands below preserve the historical experiment workflow, whose frozen graders have known defects.
Before a new confirmatory experiment, revise and independently validate its protocol and graders, then freeze fresh materials; do not reuse the historical ready receipt as approval.

```shell
npm run check:skill-ablation
npm run benchmark:skills:ablation:preflight
npm run benchmark:skills:ablation -- --output /absolute/path/to/new-evidence-directory
npm run benchmark:skills:ablation:analyze -- /absolute/path/to/evidence-directory
node benchmark/skills/agentic/ablation/blind-review.mjs /absolute/path/to/evidence-directory
```

To reproduce the exploratory corrections against a completed evidence directory with its archived runtime, use:

```shell
node benchmark/skills/agentic/ablation/postrun.mjs /absolute/path/to/evidence-directory
```

This creates separate `fairness/` and `quality/` reports and refuses to overwrite existing recheck directories.
It runs no model attempts and preserves every measured cost and original score.

Live runs send the frozen task prompts and agent-selected materials through the signed-in Codex service.
The evidence directory preserves all attempts, including failures, together with source artifacts, tool traces, cumulative usage, allocation metadata, and the runtime archive.
The final source review receives anonymized prompt/source pairs without conditions, read histories, or scores.

These are benchmark-only materials.
They do not change package runtime behavior or published consumer Skills.
