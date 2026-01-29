export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'error' | 'note';

export type AlertState = 'open' | 'fixed' | 'dismissed';

export interface UnifiedAlert {
  id: string;
  type: 'code-scanning' | 'dependabot' | 'secret-scanning';
  title: string;
  description: string;
  severity: AlertSeverity;
  state: AlertState;
  url: string;
  createdAt: string;
  location?: string;
  cveId?: string;
  affectedVersions?: string;
  fixedVersions?: string;
}
