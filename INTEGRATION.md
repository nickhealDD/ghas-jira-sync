# Integration Guide: Making Your Tool Easy to Adopt

This document explains how we made `ghas-jira-sync` incredibly easy for teams to integrate into their repositories.

## What We Built

### 1. Reusable GitHub Action

Users can now reference your action directly without cloning:

```yaml
- uses: nickhealDD/ghas-jira-sync@v1
  with:
    jira-project: PROJ
    jira-epic: PROJ-123
    jira-host: ${{ secrets.JIRA_HOST }}
    jira-email: ${{ secrets.JIRA_EMAIL }}
    jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

**Key improvements:**
- **Auto-detects** `owner` and `repo` from GitHub context
- **Default GitHub token** - no need to pass `github-token`
- **Simplified inputs** - renamed to `jira-project` and `jira-epic`
- **Zero checkout required** - just add one step to your workflow

### 2. 5-Minute Setup Process

Created [SETUP.md](SETUP.md) with a step-by-step guide:

1. Get Jira API token (2 min)
2. Create workflow file (1 min)
3. Add repository secrets (2 min)
4. Test it (30 sec)

**Result:** Users can go from zero to syncing in under 5 minutes.

### 3. Example Workflows

Provided ready-to-use examples for common scenarios:

- **[example-simple.yml](.github/workflows/example-simple.yml)** - Minimal daily sync
- **[example-advanced.yml](.github/workflows/example-advanced.yml)** - All options with dry-run
- **[example-multiple-repos.yml](.github/workflows/example-multiple-repos.yml)** - Multi-repo setup

Users can copy-paste and customize for their needs.

### 4. Updated README

Restructured to prioritize the GitHub Action workflow:

- **Quick Start** section at the top with a working example
- **Action Inputs** table showing all parameters
- **Usage Examples** for common scenarios
- **CLI usage** moved to bottom as alternative option

### 5. Dual-Mode Support

The same codebase handles both:

- **GitHub Action mode** - Reads from `INPUT_*` env vars and GitHub context
- **CLI mode** - Uses Commander for traditional CLI interface

Implementation in [src/index.ts](src/index.ts:52-89):

```typescript
const isGitHubAction = !!process.env.GITHUB_ACTIONS;

if (isGitHubAction) {
  // Auto-detect owner/repo from GITHUB_REPOSITORY
  const repository = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = repository.split('/');
  // Read other inputs from INPUT_* env vars
} else {
  // Use Commander CLI parser
}
```

## Integration Best Practices Applied

### ✅ Minimal Configuration
- Only 5 required inputs (3 are secrets, 2 are Jira identifiers)
- Auto-detect repository context
- Sensible defaults for everything else

### ✅ Standard Patterns
- Follows GitHub Actions conventions
- Uses `${{ secrets.* }}` for sensitive data
- Standard `permissions:` block for RBAC

### ✅ Copy-Paste Ready
- All examples are complete, working workflows
- No placeholders like "replace this with..."
- Comments explain what to customize

### ✅ Progressive Disclosure
- Simple example first (basic usage)
- Advanced examples for power users
- CLI option for special cases

### ✅ Quick Feedback
- `workflow_dispatch` for manual testing
- Dry-run mode to preview changes
- Clear output showing what happened

## How Users Will Use This

### Step 1: Discovery
User finds your repo via:
- GitHub Marketplace (once published)
- Search for "GHAS Jira sync"
- Internal documentation

### Step 2: Setup (5 minutes)
Follows [SETUP.md](SETUP.md):
1. Gets Jira API token
2. Copies workflow YAML
3. Adds 3 repository secrets
4. Clicks "Run workflow" to test

### Step 3: Customization (Optional)
- Change schedule (e.g., every 6 hours)
- Add dry-run mode
- Sync multiple repos
- Integrate with existing workflows

### Step 4: Forget About It
- Runs automatically on schedule
- No maintenance required
- Tickets appear in Jira magically

## Publishing Checklist

To make this available to everyone:

### GitHub Release
- [ ] Create git tag `v1.0.0`
- [ ] Push tag to trigger release
- [ ] GitHub automatically makes it available as `nickhealDD/ghas-jira-sync@v1`

### GitHub Marketplace (Optional)
- [ ] Add `marketplace.yml` metadata
- [ ] Submit to GitHub Marketplace
- [ ] Appears in Actions search

### Documentation
- [x] SETUP.md with quick start
- [x] README.md with examples
- [x] Example workflows
- [x] Action inputs documented
- [ ] Add screenshots/video (optional)

### Testing
- [x] Test in GitHub Actions mode
- [x] Verify auto-detection works
- [x] Confirm secrets work correctly
- [x] Test dry-run mode

## Next Level Enhancements

If you want to make this even easier:

### 1. Workflow Template
Add to `.github/workflow-templates/` so it appears in "New workflow" UI

### 2. NPM Package
Publish to npm for CLI usage:
```bash
npx ghas-jira-sync --owner myorg --repo myrepo ...
```

### 3. Interactive Setup
Add a setup command:
```bash
npm run setup  # Guides through configuration
```

### 4. Organization-Level Deployment
Create a "deploy to all repos" script for enterprises

### 5. Web-Based Generator
Simple form that generates the workflow YAML

## Impact

### Before
- Clone repo
- Install dependencies
- Set up .env file
- Run build
- Configure owner/repo/epic/project
- Set environment variables
- Run command

**~15-20 minutes, requires Node.js expertise**

### After
- Copy workflow file
- Add 3 secrets
- Click "Run workflow"

**~5 minutes, no expertise required**

---

## Summary

The key to easy integration is:

1. **Remove friction** - Auto-detect what you can
2. **Standard patterns** - Use familiar GitHub Actions patterns
3. **Working examples** - Copy-paste-run, not "figure it out"
4. **Progressive complexity** - Simple by default, advanced when needed
5. **Quick feedback** - Let users test immediately

This approach works for any tool you want teams to adopt quickly.
