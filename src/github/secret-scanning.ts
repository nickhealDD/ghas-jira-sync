import { Octokit } from '@octokit/rest';
import { UnifiedAlert, AlertSeverity, AlertState } from './types.js';

export async function fetchSecretScanningAlerts(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<UnifiedAlert[]> {
  try {
    const { data } = await octokit.secretScanning.listAlertsForRepo({
      owner,
      repo,
      state: 'open',
      per_page: 100,
    });

    return data.map((alert) => ({
      id: `secret-scanning-${alert.number}`,
      type: 'secret-scanning' as const,
      title: `${alert.secret_type_display_name} exposed`,
      description: `Secret type: ${alert.secret_type}`,
      severity: 'critical' as AlertSeverity,
      state: mapSecretScanningState(alert.state || 'open'),
      url: alert.html_url || '',
      createdAt: alert.created_at || new Date().toISOString(),
      location: alert.locations_url,
    }));
  } catch (error) {
    if (isAccessError(error)) {
      console.warn('Secret scanning not available or not enabled for this repository');
      console.warn('Note: Secret scanning requires GitHub Advanced Security for private repos');
      console.warn('      and a token with "security_events" scope or "secret_scanning_alerts" permission');
      return [];
    }
    throw error;
  }
}

function mapSecretScanningState(state: string): AlertState {
  if (state === 'open') return 'open';
  if (state === 'resolved') return 'fixed';
  return 'dismissed';
}

function isAccessError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 404 || error.status === 403)
  );
}
