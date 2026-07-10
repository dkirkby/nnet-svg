# Releasing nnet-svg

## One-time setup (first release, done manually)

The very first publish must happen from a local machine, because npm's
trusted-publishing settings live on the package page, which doesn't exist
until the package does.

1. Log in as `dkirkby` (opens a browser window):

   ```sh
   npm login
   npm whoami   # should print: dkirkby
   ```

2. Sanity-check what will be shipped (should be dist/, README, LICENSE,
   package.json only):

   ```sh
   npm pack --dry-run
   ```

3. Publish (the `prepublishOnly` script runs the tests and build first):

   ```sh
   npm publish
   ```

4. Verify: `npm view nnet-svg` and https://www.npmjs.com/package/nnet-svg,
   then try it in an Observable notebook cell:

   ```js
   nn = import("https://esm.sh/nnet-svg@0.1")
   ```

5. Tag the released commit (the Release workflow sees the version is already
   on npm and skips republishing):

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

6. Enable trusted publishing for future automated releases: on
   https://www.npmjs.com/package/nnet-svg/access ("Settings"), under
   **Trusted Publisher** choose **GitHub Actions** and enter:
   - Organization or user: `dkirkby`
   - Repository: `nnet-svg`
   - Workflow filename: `release.yml`
   - Environment: leave empty

## Every release after that (automated)

```sh
npm version patch   # or: minor / major — bumps package.json and creates the git tag
git push --follow-tags
```

The Release workflow (.github/workflows/release.yml) runs on the `v*` tag:
typecheck, tests, build, then `npm publish` authenticated via trusted
publishing (OIDC, no stored token) with provenance attached.

If trusted publishing is not configured, the publish step fails with an auth
error; either complete step 6 above, or fall back to a granular npm access
token stored as a `NPM_TOKEN` repo secret and passed as `NODE_AUTH_TOKEN` in
the workflow's publish step.
