# Deploying Next.js 15 to GitHub Pages

This doc walks through the setup to deploy a static Next.js 15 website automatically to GitHub Pages when a push is made to the `main` branch.

## Requirements
- Node 20 or newer
- pnpm 9
- Next.js 15 (with the app directory)

## Configuration steps

### 1. Configure Next.js for GitHub Pages

`next.config.js` needs to be configured to ensure the Next.js app works correctly when deployed to a GitHub Pages subpath.

- `output` option to `'export'` so that Next.js generates a static HTML export of the site.
- `trailingSlash` so that all URLs end with a slash, which is important for static hosting on GitHub Pages.
- `basePath` and `assetPrefix` to match the repository name (`/auto_analyst_ui`). This ensures that all routes and static assets are correctly prefixed and accessible from the subpath GitHub Pages uses.
- `images.unoptimized` to `true` because GitHub Pages cannot handle Next.js's default image optimization.

With these settings, the static site will be generated and ready to serve from the following URL:

`https://a5-cc.github.io/auto_analyst_ui/`

### 2. CI/CD workflow with GitHub Actions

The workflow is defined in the file `.github/workflows/deploy.yml`.

It is triggered by a push to the `main` branch.

### 3. Test the deployment

Test the deployment by running the following commands:

```bash
curl -I https://a5-cc.github.io/auto_analyst_ui/next.svg
```

```bash
curl -I https://a5-cc.github.io/auto_analyst_ui/
```

If both commands return HTTP 200, the deployment is successful.

### 4. Check deployment status in real-time

Check the current status of the deployment using the GitHub CLI:

```bash
gh api repos/A5-CC/auto_analyst_ui/pages/builds -q '.[0].status'
```

This command will return the status of the most recent build. Common status values include:
- `built`: The build completed successfully
- `building`: The build is in progress
- `errored`: The build failed