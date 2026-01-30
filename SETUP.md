# 5-Minute Setup Guide

Get your repository syncing GHAS alerts to Jira in 5 minutes.

## Prerequisites

- GitHub repository with GHAS enabled (Dependabot, Code Scanning, or Secret Scanning)
- Jira project and epic for security tickets
- GitHub Personal Access Token with security alert permissions
- 5 minutes

## Step 1: Create GitHub Personal Access Token (2 minutes)

1. Go to GitHub **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Click **"Generate new token"**
3. Configure:
   - **Token name**: `GHAS Jira Sync`
   - **Expiration**: 90 days (or your org's maximum)
   - **Repository access**: Only select repositories → Choose your repository
   - **Repository permissions**:
     - Dependabot alerts: `Read-only`
     - Code scanning alerts: `Read-only` (if using code scanning)
     - Secret scanning alerts: `Read-only` (if using secret scanning)
4. Click **"Generate token"** and copy it
5. Save it somewhere safe - you'll need it in step 3

> **Why not use the default `GITHUB_TOKEN`?** The default token can't access Dependabot alerts. You need a PAT or GitHub App.

## Step 2: Get Your Jira API Token (1 minute)

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name like "GHAS Sync"
4. Click **"Create"** and copy the token
5. Save it somewhere safe - you'll need it in step 3

## Step 3: Create the Workflow File (1 minute)

In your repository, create a new file: `.github/workflows/ghas-jira-sync.yml`

Paste this content:

```yaml
name: Sync Security Alerts to Jira

on:
  schedule:
    - cron: '0 9 * * *' # Daily at 9 AM UTC
  workflow_dispatch: # Allows manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync GHAS to Jira
        uses: nickheal/ghas-jira-sync@v1
        with:
          github-token: ${{ secrets.GH_SECURITY_TOKEN }}
          jira-project: ${{ vars.JIRA_PROJECT }}
          jira-epic: ${{ vars.JIRA_EPIC }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

> **Note:** You can also hardcode `jira-project` and `jira-epic` directly in the workflow if you prefer (e.g., `jira-project: PROJ`). Using variables makes it easier to reuse across multiple workflows.

## Step 4: Add Repository Secrets & Variables (2 minutes)

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**

### Add Secrets (sensitive data)

Click the **"Secrets"** tab, then **"New repository secret"** and add these:

| Secret Name          | Value                 | Example                         |
| -------------------- | --------------------- | ------------------------------- |
| `GH_SECURITY_TOKEN`  | Token from Step 1     | `github_pat_11A...`             |
| `JIRA_HOST`          | Your Jira URL         | `https://company.atlassian.net` |
| `JIRA_EMAIL`         | Your Jira email       | `you@company.com`               |
| `JIRA_API_TOKEN`     | Token from Step 2     | `ATATT3xFf...`                  |

### Add Variables (non-sensitive config)

Click the **"Variables"** tab, then **"New repository variable"** and add these:

| Variable Name  | Value                 | Example    |
| -------------- | --------------------- | ---------- |
| `JIRA_PROJECT` | Your Jira project key | `PROJ`     |
| `JIRA_EPIC`    | Your epic ticket ID   | `PROJ-123` |

> **Why separate secrets and variables?** Secrets are encrypted and hidden (for credentials). Variables are visible and easier to edit (for configuration like project keys).

## Step 5: Test It! (30 seconds)

1. Go to **Actions** tab in your repo
2. Click **"Sync Security Alerts to Jira"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch it run - should complete in under a minute
5. Check your Jira epic - you should see new tickets!

## Done! 🎉

Your repository will now automatically sync GHAS alerts to Jira daily at 9 AM UTC. You can manually trigger it anytime from the Actions tab.

> **💡 Token expires in 90 days**: Remember to renew your GitHub PAT before it expires. GitHub will send you reminder emails.

---

## Alternative: GitHub App (More Secure)

If you want more security with short-lived tokens (1-hour expiration), use a GitHub App instead of a PAT:

1. Create a GitHub App with Dependabot/Code scanning/Secret scanning permissions
2. Generate a private key
3. Use the `actions/create-github-app-token@v1` action to generate tokens
4. See the [main README](README.md#option-1-github-app-recommended) for detailed setup

**Trade-offs:**
- **PAT** (what we used): Simple setup, 90-day tokens, needs manual renewal
- **GitHub App**: More setup, 1-hour tokens (auto-renewed), better security

---

## Customization Options

### Change the Schedule

Run every 6 hours instead of daily:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'
```

### Add Dry Run Mode

Preview what would be created without actually creating tickets:

```yaml
on:
  workflow_dispatch:
    inputs:
      dry-run:
        description: 'Preview only (no ticket creation)'
        type: boolean
        default: false

# Then in the action:
with:
  dry-run: ${{ inputs.dry-run || false }}
  # ... other inputs
```

### Sync Multiple Repositories

See [example-multiple-repos.yml](.github/workflows/example-multiple-repos.yml) for syncing multiple repos to one epic.

### Use Organization-Level Secrets

If you have multiple repos to sync, use [organization secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-an-organization) instead of repository secrets.

---

## Troubleshooting

### "Authentication failed"

- Double-check your `JIRA_HOST` doesn't have a trailing slash
- Verify your API token is correct and hasn't expired
- Make sure `JIRA_EMAIL` matches the account that created the token

### "Secret scanning not available"

Secret scanning requires GitHub Advanced Security for private repos. This is normal - the action will skip secret scanning and sync the other alert types.

### "No alerts found"

Make sure:

- Dependabot is enabled in **Settings** → **Security** → **Dependabot**
- Code Scanning is enabled in **Settings** → **Security** → **Code scanning**
- Your repo has actual vulnerabilities to report

### "Epic not found"

- Verify the epic key is correct (e.g., `PROJ-123`, not just `123`)
- Make sure your Jira user has access to the project and epic
- Check the epic exists and isn't archived

---

## Advanced Examples

See the [.github/workflows](.github/workflows) folder for more examples:

- [example-simple.yml](.github/workflows/example-simple.yml) - Minimal configuration
- [example-advanced.yml](.github/workflows/example-advanced.yml) - All available options
- [example-multiple-repos.yml](.github/workflows/example-multiple-repos.yml) - Multi-repo sync

## Need Help?

- Check the [main README](README.md) for detailed documentation
- See [example workflows](.github/workflows)
- [Open an issue](https://github.com/nickheal/ghas-jira-sync/issues) if you're stuck
