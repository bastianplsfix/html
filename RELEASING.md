# Releasing

Releases are published from GitHub Actions so JSR can attach OIDC provenance.
The JSR package must be linked to `bastianplsfix/html` in the package settings
before the workflow can authenticate.

## Prepare a release

1. Work from a clean, current `main` branch.
2. Update `deno.json`, `CHANGELOG.md`, documentation install examples, and the
   standalone example to the same version.
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

## Publish

Create and push a signed or annotated tag matching the package version exactly:

```sh
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The tag workflow verifies the version and changelog section, repeats the full
checks and JSR dry-run, publishes with provenance, then creates a GitHub release
from that version's changelog notes. Do not publish the same version manually;
JSR versions are immutable.

After the workflow completes, verify the package page, provenance, generated API
documentation, GitHub release, standalone published-package example, and the
production documentation smoke check.
