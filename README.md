# GHAS-Jira-Sync

Automatically sync GitHub Advanced Security (GHAS) alerts to Jira tickets. Add one workflow file to your repo and get instant GHAS → Jira integration.

## Quick Start

**Add this to `.github/workflows/ghas-jira-sync.yml`:**

```yaml
name: Sync Security Alerts to Jira

on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      # Generate short-lived token from GitHub App (recommended)
      - name: Generate GitHub App token
        id: generate-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      # Sync GHAS alerts to Jira
      - name: Sync GHAS to Jira
        uses: nickhealDD/ghas-jira-sync@v1
        with:
          github-token: ${{ steps.generate-token.outputs.token }}
          jira-project: ${{ vars.JIRA_PROJECT }}
          jira-epic: ${{ vars.JIRA_EPIC }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

> **⚠️ Important:** The default `GITHUB_TOKEN` cannot access Dependabot alerts. See [Authentication Setup](#authentication-setup) below.

## Authentication Setup

The action requires a GitHub token with access to security alerts. The default `GITHUB_TOKEN` has **limited access** and cannot read Dependabot alerts.

### Understanding GitHub Token Permissions

| Alert Type | `GITHUB_TOKEN` with `security-events: read` | Personal Access Token | GitHub App |
|------------|---------------------------------------------|----------------------|------------|
| Code Scanning | ✅ Yes | ✅ Yes | ✅ Yes |
| Secret Scanning | ✅ Yes | ✅ Yes | ✅ Yes |
| **Dependabot** | ❌ **No** | ✅ Yes | ✅ Yes |

> **Why?** GitHub restricts `GITHUB_TOKEN` access to Dependabot alerts for security reasons. You must use either a Personal Access Token (PAT) or GitHub App.

### Option 1: GitHub App (Recommended)

GitHub Apps generate **short-lived tokens** (1-hour expiration) and are the most secure option.

#### Step 1: Create a GitHub App

1. Go to your organization/user **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
2. Configure the app:
   - **GitHub App name**: `GHAS Jira Sync`
   - **Homepage URL**: Your repository URL
   - **Webhook**: Uncheck "Active"
   - **Repository permissions**:
     - Dependabot alerts: `Read-only`
     - Code scanning alerts: `Read-only`
     - Secret scanning alerts: `Read-only`
     - Contents: `Read-only`
   - **Where can this GitHub App be installed?**: Only on this account
3. Click **Create GitHub App**

#### Step 2: Generate Private Key

1. In your app settings, scroll to **Private keys**
2. Click **Generate a private key**
3. Save the downloaded `.pem` file

#### Step 3: Install the App

1. Go to **Install App** in the left sidebar
2. Click **Install** next to your organization/account
3. Select **Only select repositories** → Choose your repository
4. Click **Install**

#### Step 4: Add Secrets to Your Repository

1. Go to your repository **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - **`APP_ID`**: The App ID (found at the top of your GitHub App settings)
   - **`APP_PRIVATE_KEY`**: The entire contents of the `.pem` file (including BEGIN/END lines)

#### Step 5: Use in Workflow

```yaml
jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Generate GitHub App token
        id: generate-token
        uses: actions/create-github-app-token@v1  # Official GitHub action
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Sync GHAS to Jira
        uses: nickhealDD/ghas-jira-sync@v1
        with:
          github-token: ${{ steps.generate-token.outputs.token }}
          # ... other inputs
```

> **Why `actions/create-github-app-token`?** This is GitHub's **official action** for GitHub App authentication, maintained by GitHub themselves. It's more trustworthy and better maintained than third-party alternatives.

### Option 2: Personal Access Token (Alternative)

If you can't use a GitHub App, use a fine-grained PAT with a short expiration.

#### Create a Fine-Grained PAT

1. Go to **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Configure:
   - **Token name**: `GHAS Jira Sync`
   - **Expiration**: 90 days (or your organization's maximum)
   - **Repository access**: Only select repositories → Choose your repository
   - **Repository permissions**:
     - Dependabot alerts: `Read-only`
     - Code scanning alerts: `Read-only`
     - Secret scanning alerts: `Read-only`
     - Contents: `Read-only`
4. Click **Generate token** and copy it

#### Add to Repository Secrets

1. Go to your repository **Settings** → **Secrets and variables** → **Actions**
2. Add secret:
   - **Name**: `GH_SECURITY_TOKEN`
   - **Value**: Your PAT

#### Use in Workflow

```yaml
- name: Sync GHAS to Jira
  uses: nickhealDD/ghas-jira-sync@v1
  with:
    github-token: ${{ secrets.GH_SECURITY_TOKEN }}
    # ... other inputs
```

> **⚠️ Remember:** You'll need to rotate this token before it expires. GitHub will send reminder emails.

### Option 3: Classic PAT (Not Recommended)

If fine-grained tokens aren't available, use a classic PAT with these scopes:
- ✅ `repo` (Full control of private repositories)
- ✅ `security_events` (Read and write security events)

**Note:** Classic PATs have broader access than necessary. Use fine-grained tokens or GitHub Apps instead.

## Features

- 🔒 **Comprehensive Coverage**: Syncs Code Scanning, Dependabot, and Secret Scanning alerts
- 🎯 **Smart Deduplication**: Prevents duplicate tickets using unique alert labels
- 📊 **Epic Organization**: Groups all security tickets under a specified epic
- 🎨 **Severity Mapping**: Automatically maps alert severity to Jira priorities
- ⚡ **Zero Config**: Auto-detects repository context, just add the workflow
- 🧪 **Dry Run Mode**: Preview changes before creating tickets

## Tech Stack

- **Runtime**: Node.js 22 LTS
- **Language**: TypeScript 5.x (ESM modules)
- **GitHub API**: `@octokit/rest`
- **Jira API**: `jira.js`
- **CLI**: `commander`
- **Validation**: `zod`

## Prerequisites

**For GitHub Action (recommended):**
- GitHub App or Personal Access Token with security alert permissions (see [Authentication Setup](#authentication-setup))
- Jira account with API token
- Jira project and epic created

**For CLI usage:**
- Node.js 22 LTS or higher
- GitHub Personal Access Token with `repo` and `security_events` scopes
- Jira account with API token

## Configuration

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `jira-project` | ✅ Yes | - | Jira project key (e.g., `PROJ`) |
| `jira-epic` | ✅ Yes | - | Jira epic ID (e.g., `PROJ-123`) |
| `jira-host` | ✅ Yes | - | Jira instance URL (e.g., `https://company.atlassian.net`) |
| `jira-email` | ✅ Yes | - | Jira account email |
| `jira-api-token` | ✅ Yes | - | Jira API token |
| `github-token` | ⚠️ **Required** | `github.token` | GitHub token with security alert access. **Default token cannot access Dependabot alerts** - use GitHub App or PAT |
| `owner` | No | Auto-detected | GitHub organization or user |
| `repo` | No | Auto-detected | Repository name |
| `dry-run` | No | `false` | Preview without creating tickets |

### Repository Configuration

Go to **Settings** → **Secrets and variables** → **Actions**:

**Secrets tab** (sensitive credentials):
1. **JIRA_HOST** - Your Jira URL (e.g., `https://company.atlassian.net`)
2. **JIRA_EMAIL** - Your Jira email
3. **JIRA_API_TOKEN** - [Create a token here](https://id.atlassian.com/manage-profile/security/api-tokens)

**Variables tab** (non-sensitive config):
1. **JIRA_PROJECT** - Your Jira project key (e.g., `PROJ`)
2. **JIRA_EPIC** - Your epic ticket ID (e.g., `PROJ-123`)

> **Tip:** You can also hardcode `jira-project` and `jira-epic` in your workflow if you prefer. Variables are better for reusing across multiple workflows or if you want to change them without editing workflow files.

## Usage Examples

### Basic Daily Sync (GitHub App)

The recommended setup using a GitHub App for secure, short-lived tokens:

```yaml
name: Sync Security Alerts

on:
  schedule:
    - cron: '0 9 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Generate GitHub App token
        id: generate-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Sync GHAS to Jira
        uses: nickhealDD/ghas-jira-sync@v1
        with:
          github-token: ${{ steps.generate-token.outputs.token }}
          jira-project: ${{ vars.JIRA_PROJECT }}
          jira-epic: ${{ vars.JIRA_EPIC }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

### Using Personal Access Token

If you're using a PAT instead of a GitHub App:

```yaml
name: Sync Security Alerts

on:
  schedule:
    - cron: '0 9 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Sync GHAS to Jira
        uses: nickhealDD/ghas-jira-sync@v1
        with:
          github-token: ${{ secrets.GH_SECURITY_TOKEN }}
          jira-project: ${{ vars.JIRA_PROJECT }}
          jira-epic: ${{ vars.JIRA_EPIC }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

### Hardcoded Project and Epic

You can hardcode values instead of using repository variables:

```yaml
- name: Sync GHAS to Jira
  uses: nickhealDD/ghas-jira-sync@v1
  with:
    github-token: ${{ steps.generate-token.outputs.token }}
    jira-project: PROJ      # Hardcoded
    jira-epic: PROJ-123     # Hardcoded
    jira-host: ${{ secrets.JIRA_HOST }}
    jira-email: ${{ secrets.JIRA_EMAIL }}
    jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

### With Manual Dry Run

Add a manual trigger with optional dry-run mode:

```yaml
on:
  schedule:
    - cron: '0 9 * * *'
  workflow_dispatch:
    inputs:
      dry-run:
        description: 'Preview only (no ticket creation)'
        type: boolean
        default: false

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Generate GitHub App token
        id: generate-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Sync GHAS to Jira
        uses: nickhealDD/ghas-jira-sync@v1
        with:
          github-token: ${{ steps.generate-token.outputs.token }}
          dry-run: ${{ inputs.dry-run || false }}
          jira-project: ${{ vars.JIRA_PROJECT }}
          jira-epic: ${{ vars.JIRA_EPIC }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

### Sync Multiple Repos

Sync alerts from multiple repositories to the same epic:

```yaml
jobs:
  sync-frontend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Generate token
        id: token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Sync frontend
        uses: nickhealDD/ghas-jira-sync@v1
        with:
          github-token: ${{ steps.token.outputs.token }}
          owner: myorg
          repo: frontend-app
          jira-project: SECURITY
          jira-epic: SECURITY-100
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}

  sync-backend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Generate token
        id: token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Sync backend
        uses: nickhealDD/ghas-jira-sync@v1
        with:
          github-token: ${{ steps.token.outputs.token }}
          owner: myorg
          repo: backend-api
          jira-project: SECURITY
          jira-epic: SECURITY-100
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

See [example workflows](.github/workflows) for more use cases.

---

## CLI Usage (Alternative)

For local testing or scripting:

### Installation

```bash
git clone <repository-url>
cd ghas-jira-sync
npm install
npm run build
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `GITHUB_TOKEN` - GitHub PAT with security events scope
- `JIRA_HOST` - Jira instance URL
- `JIRA_EMAIL` - Jira account email
- `JIRA_API_TOKEN` - Jira API token

### CLI Arguments

```bash
ghas-jira-sync \
  --owner <github-org-or-user> \
  --repo <repository-name> \
  --epic <jira-epic-id> \
  --project <jira-project-key> \
  [--dry-run]
```

**Required:**
- `--owner` - GitHub organization or user
- `--repo` - GitHub repository name
- `--epic` - Jira epic ticket ID (e.g., `PROJ-123`)
- `--project` - Jira project key (e.g., `PROJ`)

**Optional:**
- `--dry-run` - Preview without creating tickets

## Usage Examples

### CLI

```bash
# Run sync with actual ticket creation
npm run dev -- --owner myorg --repo myrepo --epic PROJ-123 --project PROJ

# Dry run to preview changes
npm run dev -- --owner myorg --repo myrepo --epic PROJ-123 --project PROJ --dry-run

# Using built version
npm run build
./dist/index.js --owner myorg --repo myrepo --epic PROJ-123 --project PROJ
```

### GitHub Action

See `.github/workflows/sync.yml` for a complete example.

**Scheduled sync (daily at 9 AM UTC):**

```yaml
name: Sync GHAS Alerts to Jira

on:
  schedule:
    - cron: '0 9 * * *'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          owner: ${{ github.repository_owner }}
          repo: ${{ github.event.repository.name }}
          epic: 'PROJ-123'
          project: 'PROJ'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

## How It Works

1. **Fetch Alerts**: Retrieves all open alerts from GitHub (Code Scanning, Dependabot, Secret Scanning)
2. **Deduplicate**: Searches Jira for existing tickets using the alert URL
3. **Create Tickets**: Creates new Jira tickets for alerts without existing tickets
4. **Link to Epic**: All tickets are created under the specified epic
5. **Categorize**: Applies labels and priority based on alert type and severity

### Deduplication Strategy

The tool stores the GitHub alert URL in the Jira ticket description and uses JQL to search for existing tickets:

```jql
project = "PROJ" AND description ~ "https://github.com/org/repo/security/..."
```

This ensures each alert only creates one ticket, even across multiple runs.

### Severity Mapping

| GHAS Severity | Jira Priority |
|---------------|---------------|
| Critical      | Highest       |
| High / Error  | High          |
| Medium / Warning | Medium     |
| Low           | Low           |
| Note          | Lowest        |

## Development

### Scripts

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- --owner <org> --repo <repo> --epic <epic> --project <proj>

# Build for production
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format

# Run tests
npm test
```

### Project Structure

```
src/
├── index.ts                  # CLI entry point
├── config.ts                 # Configuration & validation
├── github/
│   ├── client.ts             # GitHub API client
│   ├── types.ts              # Alert type definitions
│   ├── code-scanning.ts      # Code scanning alerts
│   ├── dependabot.ts         # Dependabot alerts
│   └── secret-scanning.ts    # Secret scanning alerts
├── jira/
│   ├── client.ts             # Jira API client
│   ├── types.ts              # Jira type definitions
│   └── tickets.ts            # Ticket operations
└── sync/
    └── syncer.ts             # Sync orchestration
```

## Troubleshooting

### 403 Error: "Dependabot alerts not available"

**Symptoms:**
```
GET /repos/owner/repo/dependabot/alerts - 403
Dependabot alerts not available or not enabled for this repository
```

**Cause:** You're using the default `GITHUB_TOKEN`, which cannot access Dependabot alerts.

**Solution:** Use a GitHub App or Personal Access Token instead. See [Authentication Setup](#authentication-setup).

### 403 Error for Code/Secret Scanning

**Symptoms:**
```
GET /repos/owner/repo/code-scanning/alerts - 403
Code scanning not available or not enabled for this repository
```

**Possible causes:**
1. **Feature not enabled**: Enable Code Scanning or Secret Scanning in Settings → Code security and analysis
2. **Private repository without GHAS**: GitHub Advanced Security is required for private repos
3. **Token lacks permissions**: Ensure your GitHub App or PAT has the correct permissions

**For GitHub App:** Check that these permissions are set to "Read-only":
- Code scanning alerts
- Secret scanning alerts
- Dependabot alerts

**For PAT:** Ensure you have:
- Classic PAT: `repo` + `security_events` scopes
- Fine-grained PAT: Read-only access to security alerts

### "Code scanning not available" (Warning, not error)

This is just a warning if code scanning isn't enabled. Enable it in Settings → Security → Code scanning if you want to sync those alerts.

### "Secret scanning not available" (Warning, not error)

Secret scanning requires GitHub Advanced Security for private repositories. It's automatically available for public repositories.

### Authentication Errors

**GitHub token errors:**
- Ensure your GitHub App has the correct repository permissions
- For PATs, verify the token has `security_events` scope (Classic) or security alert permissions (Fine-grained)
- Check that the token hasn't expired
- Verify the GitHub App is installed on the repository

**Jira authentication errors:**
- Verify your API token is valid and hasn't expired
- Ensure the email matches the account that owns the API token
- Check that the Jira host URL is correct (e.g., `https://company.atlassian.net`)

### JQL Search Issues

If tickets aren't being deduplicated, check that:
1. The Jira project key matches exactly
2. The description field is searchable in Jira
3. The alert URL format hasn't changed

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
