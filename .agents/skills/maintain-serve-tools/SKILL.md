---
name: maintain-serve-tools
description: Maintain packages in the serve-tools/web-tools repository. Use when changing, reviewing, testing, documenting, or packaging any @serve-tools workspace here, especially when public behavior, declarations, exports, Agent Skills, or package tarballs change. Do not use merely to consume an installed @serve-tools package in another repository.
---

# Maintain serve-tools/web-tools

## Route to the package contract

1. Read the repository `AGENTS.md` and preserve unrelated changes.
2. Identify every affected workspace from the root `package.json` and internal dependency graph.
3. Read the package README, `package.json`, public source entrypoints, declarations, tests, and its package-owned Skill.
4. For package locations and Skill paths, consult [the package map](references/package-map.md).

## Keep contract surfaces aligned

- Update runtime behavior, public types, exports, tests, README, and the package Skill together when semantics change.
- Keep `exports` as the only public entrypoint map. Do not add top-level `main` or `types`.
- Keep generated declarations beside their JavaScript files.
- Preserve native web-platform behavior and explicit ownership, cancellation, and disposal boundaries.
- Keep each published Skill focused on consumer usage. Put repository maintenance procedure here instead of shipping it in npm packages.
- Do not add lifecycle scripts, registry operations, git mutations, or GitHub mutations without explicit authorization.

## Validate narrowly, then authoritatively

1. Run the affected workspace's typecheck and tests while iterating.
2. Run its build and package-shape check.
3. Run `npm run check:skills` when Skill or package metadata changes.
4. Run `npm ci --ignore-scripts` when dependency state must be established.
5. Run `npm run verify` before handoff.

Inspect actual output and report environment-caused browser failures separately from assertion failures.
