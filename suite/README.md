# @serve-tools/skills

Package-selection guidance for the `@serve-tools` web platform utilities.
This package contains no runtime JavaScript and adds no application dependencies.

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
