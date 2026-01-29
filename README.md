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
      security-events: read
      contents: read
    steps:
      - uses: nickhealDD/ghas-jira-sync@v1
        with:
          jira-project: ${{ vars.JIRA_PROJECT }}
          jira-epic: ${{ vars.JIRA_EPIC }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

**📖 [Complete 5-Minute Setup Guide →](SETUP.md)**

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
- Jira account with API token
- Jira project and epic created

**For CLI usage:**
- Node.js 22 LTS or higher
- GitHub Personal Access Token with `repo` and `security_events` scopes

## Configuration

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `jira-project` | ✅ Yes | - | Jira project key (e.g., `PROJ`) |
| `jira-epic` | ✅ Yes | - | Jira epic ID (e.g., `PROJ-123`) |
| `jira-host` | ✅ Yes | - | Jira instance URL (e.g., `https://company.atlassian.net`) |
| `jira-email` | ✅ Yes | - | Jira account email |
| `jira-api-token` | ✅ Yes | - | Jira API token |
| `owner` | No | Auto-detected | GitHub organization or user |
| `repo` | No | Auto-detected | Repository name |
| `github-token` | No | `github.token` | GitHub token with security events scope |
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

### Basic Daily Sync

The simplest setup - syncs alerts daily at 9 AM UTC:

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
      security-events: read
      contents: read
    steps:
      - uses: nickhealDD/ghas-jira-sync@v1
        with:
          jira-project: ${{ vars.JIRA_PROJECT }}
          jira-epic: ${{ vars.JIRA_EPIC }}
          jira-host: ${{ secrets.JIRA_HOST }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
```

**Alternative:** Hardcode the project and epic if you prefer:

```yaml
- uses: nickhealDD/ghas-jira-sync@v1
  with:
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

# In the action step:
- uses: nickhealDD/ghas-jira-sync@v1
  with:
    dry-run: ${{ inputs.dry-run || false }}
    # ... other inputs
```

### Sync Multiple Repos

Sync alerts from multiple repositories to the same epic:

```yaml
jobs:
  sync-frontend:
    runs-on: ubuntu-latest
    permissions:
      security-events: read
      contents: read
    steps:
      - uses: nickhealDD/ghas-jira-sync@v1
        with:
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
      security-events: read
      contents: read
    steps:
      - uses: nickhealDD/ghas-jira-sync@v1
        with:
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

### "Code scanning not available"

This warning appears if code scanning is not enabled. Enable it in your repository settings under Security > Code scanning.

### "Dependabot alerts not available"

Enable Dependabot in Settings > Security > Dependabot alerts.

### "Secret scanning not available"

Secret scanning requires GitHub Advanced Security for private repositories. It's automatically available for public repositories.

### Authentication Errors

- **GitHub**: Ensure your token has `repo` and `security_events` scopes
- **Jira**: Verify your API token is valid and hasn't expired

### JQL Search Issues

If tickets aren't being deduplicated, check that:
1. The Jira project key matches exactly
2. The description field is searchable in Jira
3. The alert URL format hasn't changed

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
