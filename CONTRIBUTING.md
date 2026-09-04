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

Packages are independently versioned and published through the `Release` GitHub Actions workflow.
Run it from `main`, select one package or `all`, and choose the npm distribution tag.
For one package, enter the exact version from its `package.json` as an additional safety check.
For `all`, leave the version empty; the workflow selects every publishable workspace whose exact version is not yet on npm.

The `npm` GitHub environment requires approval.
Each npm package must trust the `serve-tools/web-tools` repository's `release.yml` workflow with the `npm` environment.
The workflow checks package versions and internal dependency ranges before installing dependencies or browsers, then runs one clean install and one full verification for the complete release.
It packs and publishes selected packages in internal dependency order from the same immutable artifact set.

Dispatch and monitor a prepared batch with GitHub CLI:

```shell
gh workflow run release.yml --ref main -f package=all -f version= -f tag=latest
RUN_ID=$(gh run list --workflow release.yml --branch main --event workflow_dispatch --user "@me" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
```

Review the release plan before approving the protected `npm` environment.
The `all` selector is resumable: after a partial publish, inspect npm, fix the cause, and dispatch it again to select only versions that remain unpublished.

Trusted Publishing requires that each package already exist on npm.
For every existing package, configure its npm trusted publisher exactly as repository `serve-tools/web-tools`, workflow file `release.yml`, and environment `npm`.
The release workflow uses npm CLI `12.0.2`, retains npm provenance, and fails before publishing if GitHub has not supplied its OIDC request credentials.
Maintain npm 2FA for every maintainer; Trusted Publishing does not use or bypass a publishing token.

The five first-release packages in the approved batch cannot use Trusted Publishing until their first version exists.
Dispatch `Release` with mode `bootstrap` to verify and pack the selected release plan, then attest every selected tarball under the protected `npm` environment without publishing it.
The immutable release artifact retains the exact tarball, while `provenance-<tarball>` contains its npm-compatible provenance bundle.
A maintainer verifies the bundle, then uses an interactive `npm login` session with npm 2FA to publish that tarball with `npm publish <tarball> --access public --tag <tag> --provenance-file <bundle>`.
Run the bootstrap publish from a clean temporary directory with an isolated npm config that has no `provenance` setting, because this repository's `.npmrc` enables `provenance=true` and npm does not allow any explicit `provenance` setting with `--provenance-file`.
For a GitHub CLI verification, use the reviewed workflow identity and commit: `gh attestation verify <tarball> --bundle <bundle> --digest-alg sha512 --repo serve-tools/web-tools --cert-identity https://github.com/serve-tools/web-tools/.github/workflows/release.yml@refs/heads/main --source-ref refs/heads/main --source-digest <reviewed-sha> --deny-self-hosted-runners`.
Do not create a granular access token or add an `NPM_TOKEN` secret for bootstrap.
After verified first publication, configure the exact trusted-publisher settings above; the bootstrap constraint applies only to first publication, not later protected OIDC releases.

If publishing fails, inspect npm before retrying because published versions are immutable.
Resume with the first unpublished package; use a new patch version rather than attempting to replace an existing release.
