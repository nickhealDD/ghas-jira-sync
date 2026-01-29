import { Octokit } from '@octokit/rest';
import { Version3Client } from 'jira.js';
import { UnifiedAlert } from '../github/types.js';
import { fetchCodeScanningAlerts } from '../github/code-scanning.js';
import { fetchDependabotAlerts } from '../github/dependabot.js';
import { fetchSecretScanningAlerts } from '../github/secret-scanning.js';
import { searchExistingTicket, createTicket } from '../jira/tickets.js';

export interface SyncOptions {
  githubClient: Octokit;
  jiraClient: Version3Client;
  owner: string;
  repo: string;
  projectKey: string;
  epicKey: string;
  dryRun: boolean;
}

export interface SyncResult {
  totalAlerts: number;
  newTickets: number;
  existingTickets: number;
  skipped: number;
  errors: number;
}

export async function syncAlerts(options: SyncOptions): Promise<SyncResult> {
  const {
    githubClient,
    jiraClient,
    owner,
    repo,
    projectKey,
    epicKey,
    dryRun,
  } = options;

  console.log(`\nFetching GHAS alerts for ${owner}/${repo}...`);

  // Fetch all alert types in parallel
  const [codeScanningAlerts, dependabotAlerts, secretScanningAlerts] =
    await Promise.all([
      fetchCodeScanningAlerts(githubClient, owner, repo),
      fetchDependabotAlerts(githubClient, owner, repo),
      fetchSecretScanningAlerts(githubClient, owner, repo),
    ]);

  const allAlerts: UnifiedAlert[] = [
    ...codeScanningAlerts,
    ...dependabotAlerts,
    ...secretScanningAlerts,
  ];

  console.log(`Found ${allAlerts.length} total alerts:`);
  console.log(`  - Code Scanning: ${codeScanningAlerts.length}`);
  console.log(`  - Dependabot: ${dependabotAlerts.length}`);
  console.log(`  - Secret Scanning: ${secretScanningAlerts.length}`);

  const result: SyncResult = {
    totalAlerts: allAlerts.length,
    newTickets: 0,
    existingTickets: 0,
    skipped: 0,
    errors: 0,
  };

  if (allAlerts.length === 0) {
    console.log('\nNo alerts to process.');
    return result;
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Processing alerts...`);

  for (const alert of allAlerts) {
    try {
      // Check if ticket already exists
      const existingTicket = await searchExistingTicket(
        jiraClient,
        projectKey,
        alert.url,
        epicKey
      );

      if (existingTicket) {
        console.log(
          `  ✓ Ticket already exists for alert: ${alert.title} (${existingTicket.key})`
        );
        result.existingTickets++;
        continue;
      }

      // Create new ticket
      if (dryRun) {
        console.log(
          `  [DRY RUN] Would create ticket for: ${alert.title} [${alert.severity}]`
        );
        result.newTickets++;
      } else {
        try {
          const ticketKey = await createTicket(
            jiraClient,
            projectKey,
            epicKey,
            alert
          );
          console.log(
            `  ✓ Created ticket ${ticketKey} for: ${alert.title} [${alert.severity}]`
          );
          result.newTickets++;
        } catch (createError: unknown) {
          // Log the full error to understand what's happening
          console.error(
            `  ✗ Error creating ticket for "${alert.title}":`,
            createError
          );
          result.errors++;
        }
      }
    } catch (error) {
      console.error(
        `  ✗ Error processing alert "${alert.title}":`,
        error instanceof Error ? error.message : error
      );
      result.errors++;
    }
  }

  console.log('\n--- Sync Summary ---');
  console.log(`Total alerts: ${result.totalAlerts}`);
  console.log(`New tickets created: ${result.newTickets}`);
  console.log(`Existing tickets found: ${result.existingTickets}`);
  console.log(`Errors: ${result.errors}`);

  return result;
}
