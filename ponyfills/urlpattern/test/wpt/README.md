# Web Platform Tests fixtures

`urlpatterntestdata.json` vendors the Web Platform Tests project's `urlpattern/resources/urlpatterntestdata.json` fixture.
Only JSON whitespace is normalized to this repository's formatting convention.

- Upstream: https://github.com/web-platform-tests/wpt
- Source revision: `23aac9278460a73394585ff5a15b6a04dfcd5ec8`
- Source date: 2026-06-12
- Upstream fixture SHA-256: `f52a8ba3940de7e55ad47dc58eab5bccb697d7d76335c20ed7aaef6b85b98ab9`
- License: W3C 3-clause BSD license, as documented by the upstream repository.

The adjacent Vitest harness follows the canonical WPT expectation rules and runs entirely offline.
`known-failing.json` explicitly records unsupported upstream fixture indices: these cases still execute as expected-failure tests, regressions in supported cases fail normally, and unexpectedly fixed cases require removing their indices from the ledger.

Run with `WPT_STRICT=1` to disable expected-failure handling and report the exact upstream conformance gap.
Refresh the fixture deliberately and update this provenance record whenever the upstream revision changes.
