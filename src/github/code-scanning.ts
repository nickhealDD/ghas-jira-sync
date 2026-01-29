import { Octokit } from '@octokit/rest';
import { UnifiedAlert, AlertSeverity, AlertState } from './types.js';

export async function fetchCodeScanningAlerts(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<UnifiedAlert[]> {
  try {
    const { data } = await octokit.codeScanning.listAlertsForRepo({
      owner,
      repo,
      state: 'open',
      per_page: 100,
    });

    return data.map((alert) => ({
      id: `code-scanning-${alert.number}`,
      type: 'code-scanning' as const,
      title: alert.rule.description || alert.rule.id || 'Unknown rule',
      description: alert.rule.full_description || alert.rule.description || '',
      severity: mapCodeScanningSeverity(alert.rule.severity),
      state: mapCodeScanningState(alert.state || 'open'),
      url: alert.html_url,
      createdAt: alert.created_at,
      location: alert.most_recent_instance?.location?.path,
    }));
  } catch (error) {
    if (isAccessError(error)) {
      console.warn('Code scanning not available or not enabled for this repository');
      return [];
    }
    throw error;
  }
}

function mapCodeScanningSeverity(severity: string | null | undefined): AlertSeverity {
  const severityMap: Record<string, AlertSeverity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    warning: 'warning',
    error: 'error',
    note: 'note',
  };

  return severityMap[severity?.toLowerCase() || ''] || 'medium';
}

function mapCodeScanningState(state: string): AlertState {
  if (state === 'open') return 'open';
  if (state === 'fixed') return 'fixed';
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
