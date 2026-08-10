# Releasing

Releases are published from GitHub Actions so JSR can attach OIDC provenance.
The JSR package must be linked to `bastianplsfix/html` in the package settings
before the workflow can authenticate. Configure the repository's `jsr` GitHub
environment with tag restrictions and required reviewers if the organization
uses protected releases.

## Prepare a release

1. Work from a clean, current `main` branch.
2. Update `deno.json`, `CHANGELOG.md`, and documentation install examples to the
   same version. `deno task version:check` verifies the changelog's first
   release heading, README and design examples, documentation examples, sidebar
   series, and response-header assertion. Leave the standalone `examples/hello`
   package on the latest version that actually exists in JSR until the new
   release is available; it is deliberately excluded from this pre-publish drift
   check.
3. Run the reproducible local checks:

   ```sh
   deno install --frozen
   deno task check
   deno task bench:check
   deno publish --dry-run
   ```

4. For renderer performance changes, also run `deno task bench:profile` on the
   same machine before and after the change and record the comparison in the
   pull request.
5. Merge the release commit only after the minimum-version and latest-stable CI
   jobs pass.
6. Review the version's upgrade notes. In particular, confirm every documented
   consumer configuration keeps `script` and `style` in
   `jsxPrecompileSkipElements`; that setting is part of the raw-text security
   contract.

## Publish

Create and push a signed or annotated tag matching the package version exactly:

```sh
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The tag workflow verifies that the tagged commit is on `main`, checks the
version and changelog section, repeats the full checks and JSR dry-run, then
publishes with provenance. Separate resumable jobs smoke-test the exact
published version by compiling and running a real precompiled TSX consumer
against every entrypoint, then create or update a GitHub release from the
changelog notes. Registry-propagation failures are retried only in the smoke
job; `deno publish` itself runs exactly once. Do not publish the same version
manually; JSR versions are immutable.

After the workflow completes, verify the package page, provenance, generated API
documentation, GitHub release, standalone published-package example, and the
production documentation smoke check. Then advance and lock the standalone
example to the newly published version in a follow-up commit.
