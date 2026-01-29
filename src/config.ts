import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const ConfigSchema = z.object({
  github: z.object({
    token: z.string().min(1, 'GitHub token is required'),
    owner: z.string().min(1, 'GitHub owner is required'),
    repo: z.string().min(1, 'GitHub repo is required'),
  }),
  jira: z.object({
    host: z.string().url('Jira host must be a valid URL'),
    email: z.string().email('Jira email must be valid'),
    apiToken: z.string().min(1, 'Jira API token is required'),
    project: z.string().min(1, 'Jira project key is required'),
    epic: z.string().min(1, 'Jira epic ID is required'),
  }),
  dryRun: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface LoadConfigOptions {
  owner: string;
  repo: string;
  epic: string;
  project: string;
  dryRun?: boolean;
}

export function loadConfig(options: LoadConfigOptions): Config {
  const config = {
    github: {
      token: process.env.GITHUB_TOKEN || '',
      owner: options.owner,
      repo: options.repo,
    },
    jira: {
      host: process.env.JIRA_HOST || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
      project: options.project,
      epic: options.epic,
    },
    dryRun: options.dryRun || false,
  };

  return ConfigSchema.parse(config);
}
