#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config.js';
import { createGitHubClient } from './github/client.js';
import { createJiraClient } from './jira/client.js';
import { syncAlerts } from './sync/syncer.js';

// Check if running as GitHub Action
const isGitHubAction = !!process.env.GITHUB_ACTIONS;

async function runSync(options: {
  owner: string;
  repo: string;
  epic: string;
  project: string;
  dryRun: boolean;
}) {
  console.log('🔄 Starting GHAS to Jira sync...\n');

  // Load and validate configuration
  const config = loadConfig({
    owner: options.owner,
    repo: options.repo,
    epic: options.epic,
    project: options.project,
    dryRun: options.dryRun,
  });

  // Create API clients
  const githubClient = createGitHubClient(config.github.token);
  const jiraClient = createJiraClient({
    host: config.jira.host,
    email: config.jira.email,
    apiToken: config.jira.apiToken,
  });

  // Run sync
  const result = await syncAlerts({
    githubClient,
    jiraClient,
    owner: config.github.owner,
    repo: config.github.repo,
    projectKey: config.jira.project,
    epicKey: config.jira.epic,
    dryRun: config.dryRun,
  });

  // Exit with appropriate code
  const exitCode = result.errors > 0 ? 1 : 0;
  console.log('\n✅ Sync completed!');
  process.exit(exitCode);
}

if (isGitHubAction) {
  // GitHub Actions mode - read from inputs
  const getInput = (name: string): string => {
    return process.env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`] || '';
  };

  // Auto-detect owner/repo from GitHub context
  const repository = process.env.GITHUB_REPOSITORY || '';
  const [contextOwner, contextRepo] = repository.split('/');

  const owner = getInput('owner') || contextOwner || '';
  const repo = getInput('repo') || contextRepo || '';
  const epic = getInput('jira-epic');
  const project = getInput('jira-project');
  const dryRun = getInput('dry-run') === 'true';

  // Set Jira env vars if provided via inputs
  if (getInput('jira-host')) {
    process.env.JIRA_HOST = getInput('jira-host');
  }
  if (getInput('jira-email')) {
    process.env.JIRA_EMAIL = getInput('jira-email');
  }
  if (getInput('jira-api-token')) {
    process.env.JIRA_API_TOKEN = getInput('jira-api-token');
  }
  if (getInput('github-token')) {
    process.env.GITHUB_TOKEN = getInput('github-token');
  }

  runSync({ owner, repo, epic, project, dryRun }).catch((error) => {
    if (error instanceof Error) {
      console.error('\n❌ Error:', error.message);
      if (error.stack) {
        console.error('\nStack trace:', error.stack);
      }
    } else {
      console.error('\n❌ Unknown error:', error);
    }
    process.exit(1);
  });
} else {
  // CLI mode - use commander
  const program = new Command();

  program
    .name('ghas-jira-sync')
    .description('Sync GitHub Advanced Security alerts to Jira tickets')
    .version('1.0.0')
    .requiredOption('--owner <owner>', 'GitHub organization or user')
    .requiredOption('--repo <repo>', 'GitHub repository name')
    .requiredOption('--epic <epic>', 'Jira epic ticket ID (e.g., PROJ-123)')
    .requiredOption('--project <project>', 'Jira project key (e.g., PROJ)')
    .option('--dry-run', 'Preview without creating tickets', false)
    .action(async (options) => {
      try {
        await runSync({
          owner: options.owner,
          repo: options.repo,
          epic: options.epic,
          project: options.project,
          dryRun: options.dryRun,
        });
      } catch (error) {
        if (error instanceof Error) {
          console.error('\n❌ Error:', error.message);
          if (error.stack) {
            console.error('\nStack trace:', error.stack);
          }
        } else {
          console.error('\n❌ Unknown error:', error);
        }
        process.exit(1);
      }
    });

  program.parse();
}
