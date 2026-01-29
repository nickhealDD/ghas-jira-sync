import { Octokit } from '@octokit/rest';

export function createGitHubClient(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: 'ghas-jira-sync/1.0.0',
  });
}
