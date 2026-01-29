import { Octokit } from '@octokit/rest';
import { UnifiedAlert, AlertSeverity, AlertState } from './types.js';

export async function fetchDependabotAlerts(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<UnifiedAlert[]> {
  try {
    const { data } = await octokit.dependabot.listAlertsForRepo({
      owner,
      repo,
      state: 'open',
      per_page: 100,
    });

    return data.map((alert) => {
      // Extract CVE ID
      const cveId = alert.security_advisory.cve_id || alert.security_advisory.ghsa_id || undefined;

      // Extract affected versions
      const affectedVersions = alert.security_vulnerability?.vulnerable_version_range || undefined;

      // Extract fixed versions
      const fixedVersions = alert.security_vulnerability?.first_patched_version?.identifier || undefined;

      return {
        id: `dependabot-${alert.number}`,
        type: 'dependabot' as const,
        title: `${alert.security_advisory.summary} in ${alert.dependency.package?.name || 'unknown package'}`,
        description: alert.security_advisory.description,
        severity: mapDependabotSeverity(alert.security_advisory.severity),
        state: mapDependabotState(alert.state),
        url: alert.html_url,
        createdAt: alert.created_at,
        location: alert.dependency.manifest_path,
        cveId,
        affectedVersions,
        fixedVersions,
      };
    });
  } catch (error) {
    if (isAccessError(error)) {
      console.warn('Dependabot alerts not available or not enabled for this repository');
      return [];
    }
    throw error;
  }
}

function mapDependabotSeverity(severity: string): AlertSeverity {
  const severityMap: Record<string, AlertSeverity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  return severityMap[severity.toLowerCase()] || 'medium';
}

function mapDependabotState(state: string): AlertState {
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
