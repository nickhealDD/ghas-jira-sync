import { Version3Client } from 'jira.js';
import { UnifiedAlert, AlertSeverity } from '../github/types.js';
import { CreateTicketPayload, JiraIssue } from './types.js';

export async function searchExistingTicket(
  client: Version3Client,
  projectKey: string,
  alertUrl: string,
  epicKey?: string
): Promise<JiraIssue | null> {
  const alertLabel = createAlertLabel(alertUrl);
  console.log(`Searching for existing ticket with label: ${alertLabel}`);

  // Try label-based JQL search first (scoped to project)
  try {
    const jql = `project = ${projectKey} AND labels = "${alertLabel}" ORDER BY created DESC`;

    const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql,
      maxResults: 1,
      fields: ['summary', 'description', 'status', 'labels'],
    });

    if (response.issues && response.issues.length > 0) {
      const issue = response.issues[0];
      if (issue) {
        return {
          id: issue.id,
          key: issue.key,
          fields: {
            summary: issue.fields.summary,
            description: typeof issue.fields.description === 'string'
              ? issue.fields.description
              : '',
            status: {
              name: typeof issue.fields.status === 'object' && issue.fields.status !== null && 'name' in issue.fields.status
                ? String(issue.fields.status.name)
                : 'Unknown',
            },
          },
        };
      }
    }
  } catch (error) {
    console.warn(`Label search failed for ${alertLabel}:`, error instanceof Error ? error.message : error);

    // JQL search failed, try getting tickets from epic if provided
    if (epicKey) {
      try {
        const epicJql = `project = ${projectKey} AND parent = ${epicKey} AND labels = "${alertLabel}" ORDER BY created DESC`;
        const epicResponse = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
          jql: epicJql,
          maxResults: 1,
          fields: ['summary', 'description', 'status', 'labels'],
        });

        if (epicResponse.issues && epicResponse.issues.length > 0) {
          const issue = epicResponse.issues[0];
          if (issue) {
            return {
              id: issue.id,
              key: issue.key,
              fields: {
                summary: issue.fields.summary,
                description: typeof issue.fields.description === 'string'
                  ? issue.fields.description
                  : '',
                status: {
                  name: typeof issue.fields.status === 'object' && issue.fields.status !== null && 'name' in issue.fields.status
                    ? String(issue.fields.status.name)
                    : 'Unknown',
                },
              },
            };
          }
        }
      } catch (epicError) {
        console.warn(`Epic-based search also failed for ${alertLabel}:`, epicError instanceof Error ? epicError.message : epicError);
      }
    }
  }

  // Final fallback: search for the GitHub URL in ticket descriptions
  // This catches cases where labels might not be working correctly
  try {
    console.log(`Trying fallback URL-based search for: ${alertUrl}`);
    const urlSearchJql = `project = ${projectKey} AND text ~ "${alertUrl.replace(/[:"\/]/g, ' ')}" ORDER BY created DESC`;

    const urlResponse = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql: urlSearchJql,
      maxResults: 5,
      fields: ['summary', 'description', 'status', 'labels'],
    });

    if (urlResponse.issues && urlResponse.issues.length > 0) {
      // Verify the URL is actually in the description to avoid false positives
      for (const issue of urlResponse.issues) {
        const description = typeof issue.fields.description === 'object' && issue.fields.description !== null
          ? JSON.stringify(issue.fields.description)
          : String(issue.fields.description || '');

        if (description.includes(alertUrl)) {
          console.log(`Found existing ticket via URL search: ${issue.key}`);
          return {
            id: issue.id,
            key: issue.key,
            fields: {
              summary: issue.fields.summary,
              description: typeof issue.fields.description === 'string'
                ? issue.fields.description
                : '',
              status: {
                name: typeof issue.fields.status === 'object' && issue.fields.status !== null && 'name' in issue.fields.status
                  ? String(issue.fields.status.name)
                  : 'Unknown',
              },
            },
          };
        }
      }
    }
  } catch (urlError) {
    console.warn(`URL-based search failed:`, urlError instanceof Error ? urlError.message : urlError);
  }

  return null;
}

export async function createTicket(
  client: Version3Client,
  projectKey: string,
  epicKey: string,
  alert: UnifiedAlert
): Promise<string> {
  const description = buildTicketDescriptionADF(alert);
  const priority = mapSeverityToPriority(alert.severity);
  const alertLabel = createAlertLabel(alert.url);

  const labels = ['ghas', alert.type, `severity-${alert.severity}`, alertLabel];
  console.log(`Creating ticket with labels: ${labels.join(', ')}`);

  const payload: CreateTicketPayload = {
    fields: {
      project: {
        key: projectKey,
      },
      summary: `[${alert.type.toUpperCase()}] ${alert.title}`,
      description,
      issuetype: {
        name: 'Task',
      },
      priority: {
        name: priority,
      },
      parent: {
        key: epicKey,
      },
      labels,
    },
  };

  try {
    const response = await client.issues.createIssue(payload);
    return response.key;
  } catch (error: unknown) {
    // Log detailed error information
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error
    ) {
      const resp = error.response as { data?: { errors?: unknown; errorMessages?: unknown } };
      console.error('Jira API Error Details:', JSON.stringify(resp.data, null, 2));
    }
    throw error;
  }
}

function parseMarkdownToADF(markdown: string): unknown[] {
  const nodes: unknown[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line) {
      i++;
      continue;
    }

    // Handle headings (## or ###)
    if (line.startsWith('### ')) {
      nodes.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.substring(4).trim() }],
      });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      nodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.substring(3).trim() }],
      });
      i++;
      continue;
    }

    // Handle code blocks
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith('```')) {
        codeLines.push(lines[i] || '');
        i++;
      }
      if (codeLines.length > 0) {
        nodes.push({
          type: 'codeBlock',
          content: [{ type: 'text', text: codeLines.join('\n') }],
        });
      }
      i++; // Skip closing ```
      continue;
    }

    // Handle regular paragraphs with inline formatting
    const paragraphContent = parseInlineFormatting(line);
    if (paragraphContent.length > 0) {
      nodes.push({
        type: 'paragraph',
        content: paragraphContent,
      });
    }
    i++;
  }

  return nodes;
}

function parseInlineFormatting(text: string): unknown[] {
  const content: unknown[] = [];
  let currentPos = 0;

  // Simple regex patterns for inline code and links
  const patterns = [
    { regex: /`([^`]+)`/g, type: 'code' },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' },
  ];

  // For simplicity, handle inline code first
  const codeMatches = [...text.matchAll(/`([^`]+)`/g)];

  if (codeMatches.length === 0) {
    // No special formatting, just return plain text
    return [{ type: 'text', text }];
  }

  let lastIndex = 0;
  for (const match of codeMatches) {
    const matchIndex = match.index || 0;

    // Add text before the code
    if (matchIndex > lastIndex) {
      const beforeText = text.substring(lastIndex, matchIndex);
      if (beforeText) {
        content.push({ type: 'text', text: beforeText });
      }
    }

    // Add the code
    content.push({
      type: 'text',
      text: match[1],
      marks: [{ type: 'code' }],
    });

    lastIndex = matchIndex + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      content.push({ type: 'text', text: remainingText });
    }
  }

  return content.length > 0 ? content : [{ type: 'text', text }];
}

function buildTicketDescriptionADF(alert: UnifiedAlert): unknown {
  const content = [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Alert Type: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: alert.type },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Severity: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: alert.severity.toUpperCase() },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'State: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: alert.state },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Created: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: new Date(alert.createdAt).toLocaleString() },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Vulnerability Details', marks: [{ type: 'strong' }] },
      ],
    },
  ];

  // Add CVE ID if available
  if (alert.cveId) {
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'CVE ID: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: alert.cveId },
      ],
    });
  }

  // Add affected versions if available
  if (alert.affectedVersions) {
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Affected Versions: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: alert.affectedVersions },
      ],
    });
  }

  // Add fixed versions if available
  if (alert.fixedVersions) {
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Fixed in Version: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: alert.fixedVersions },
      ],
    });
  }

  // Parse the description markdown and convert to ADF
  const descriptionNodes = parseMarkdownToADF(alert.description);
  content.push(...descriptionNodes);

  if (alert.location) {
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Location: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: alert.location },
      ],
    });
  }

  content.push(
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'GitHub Alert URL: ', marks: [{ type: 'strong' }] },
      ],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: alert.url }],
    },
    {
      type: 'rule',
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This ticket was automatically created by ghas-jira-sync',
          marks: [{ type: 'em' }],
        },
      ],
    }
  );

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

function mapSeverityToPriority(severity: AlertSeverity): string {
  const priorityMap: Record<AlertSeverity, string> = {
    critical: 'Highest',
    high: 'High',
    error: 'High',
    medium: 'Medium',
    warning: 'Medium',
    low: 'Low',
    note: 'Lowest',
  };

  return priorityMap[severity] || 'Medium';
}

function createAlertLabel(alertUrl: string): string {
  // Extract a unique identifier from the alert URL and create a valid Jira label
  // Labels can't contain spaces or special chars except hyphens and underscores
  const match = alertUrl.match(/\/(dependabot|code-scanning|secret-scanning)\/(\d+)/);
  if (match) {
    const [, type, id] = match;
    return `ghas-${type}-${id}`;
  }
  // Fallback: create a hash-like identifier from the URL
  const hash = alertUrl.split('/').slice(-2).join('-').replace(/[^a-zA-Z0-9-]/g, '');
  return `ghas-alert-${hash}`;
}
