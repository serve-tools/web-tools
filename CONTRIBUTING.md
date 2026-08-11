# Contributing

## Local setup

Use Node.js 22.14 or newer and npm 11.5.1 or newer. The preferred npm version is
pinned by `packageManager`.

```sh
npm ci --ignore-scripts
npm run verify
```

## Package conventions

- Put client runtime libraries in `client/`, global-environment polyfills in
  `polyfill/`, non-global ponyfills in `ponyfill/`, and Vite plugins in
  `vite/`.
- Keep each package independently versioned, documented, and tested.
- Prefer web platform APIs over dependencies when behavior and compatibility
  are equivalent.
- Keep runtime behavior and TypeScript declarations aligned.
- Run package builds and package-shape checks before publishing.
- Do not add package lifecycle scripts or runtime downloads without explicit
  review.
