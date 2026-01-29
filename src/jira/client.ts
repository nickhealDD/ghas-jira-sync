import { Version3Client } from 'jira.js';

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
}

export function createJiraClient(config: JiraConfig): Version3Client {
  return new Version3Client({
    host: config.host,
    authentication: {
      basic: {
        email: config.email,
        apiToken: config.apiToken,
      },
    },
  });
}
