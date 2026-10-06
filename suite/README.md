# @serve-tools/skills

Help a coding agent choose the right `@serve-tools` package before it writes code.
This package contains agent instructions, package-selection rules, and common combinations.
It contains no runtime JavaScript and adds no application dependencies.

For human package discovery, start with the [web documentation catalog](https://serve-tools.github.io/web-tools/).
You do not need to install this package to use any library.

## What the guide helps an agent decide

- Choose a focused capability or a facade combining several.
- Choose imperative browser APIs or their Signal-aware counterparts.
- Choose JSON HTTP, streaming, WebSocket, or WebTransport for the task.
- Distinguish a browser client, its matching server, and SharedWorker coordination.
- Choose imported fallbacks or compatibility code that modifies globals.

The full rules are in [package selection](./skills/serve-tools-skills/references/package-selection.md), with [common combinations](./skills/serve-tools-skills/references/common-combinations.md) for tasks spanning several capabilities.

## Install for an authoring agent

Install it when an authoring agent needs suite-wide discovery before choosing a focused package:

```shell
npm install --save-dev @serve-tools/skills
```

The versioned Skill is published at `skills/serve-tools-skills/`.
Because npm installation does not activate Agent Skills, copy or link the complete directory—including `references/` and `agents/`—into a trusted Skill discovery directory.
Restrict automated discovery to direct dependencies and allowlisted package scopes.

Once the guide selects a package, use the package-specific Skill shipped with that dependency for API contracts and compile-checked recipes.

## License

[MIT-0](./LICENSE.md)
