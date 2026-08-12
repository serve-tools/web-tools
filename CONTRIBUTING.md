# Contributing

## Local setup

Use Node.js 22.14 or newer and npm 11.5.1 or newer.
The preferred npm version is pinned by `packageManager`.

```shell
npm ci --ignore-scripts
npm run verify
```

## Package conventions

- Put client runtime libraries in `client/`, Lit integrations in `lit/`, global-environment polyfills in `polyfills/`, non-global ponyfills in `ponyfills/`, and Vite plugins in `vite/`.
- Keep each package independently versioned, documented, and tested.
- Prefer web platform APIs over dependencies when behavior and compatibility are equivalent.
- Keep runtime behavior and TypeScript declarations aligned.
- Keep each public package's consumer Agent Skill aligned with its behavior, declarations, tests, and README.
  Private demo workspaces do not own Skills.
- Use semantic line breaks in authored Markdown prose: one complete sentence per source line, without column wrapping.
  Preserve structural Markdown and standardized license text.
- Run package builds and package-shape checks before publishing.
- Do not add package lifecycle scripts or runtime downloads without explicit review.

Run `npm run check:skills` after changing a Skill or package metadata.
Published Skills remain instruction-only unless executable resources have a demonstrated need and receive explicit review.

## Publishing

Packages are independently versioned and published one at a time through the `Release` GitHub Actions workflow.
Run it from `main`, select the package, enter the exact version from its `package.json`, and choose the npm distribution tag.

The `npm` GitHub environment requires approval.
Each npm package must trust the `serve-tools/web-tools` repository's `release.yml` workflow with the `npm` environment.
Publish internal dependencies before their dependants; the workflow rejects releases whose internal dependency ranges are unavailable.

Brand-new packages require a one-time bootstrap because npm cannot configure a trusted publisher before a package exists.
Create a short-lived granular token with only the required scope, write access, and bypass 2FA; store it only as the `NPM_TOKEN` secret on the `npm` environment.
After the initial publications, configure trust, require 2FA and disallow tokens on every package, then delete the secret and revoke the token.

If publishing fails, inspect npm before retrying because published versions are immutable.
Resume with the first unpublished package; use a new patch version rather than attempting to replace an existing release.
