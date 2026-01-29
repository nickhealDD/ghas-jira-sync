#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_commander = require("commander");

// src/config.ts
var import_zod = require("zod");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var ConfigSchema = import_zod.z.object({
  github: import_zod.z.object({
    token: import_zod.z.string().min(1, "GitHub token is required"),
    owner: import_zod.z.string().min(1, "GitHub owner is required"),
    repo: import_zod.z.string().min(1, "GitHub repo is required")
  }),
  jira: import_zod.z.object({
    host: import_zod.z.string().url("Jira host must be a valid URL"),
    email: import_zod.z.string().email("Jira email must be valid"),
    apiToken: import_zod.z.string().min(1, "Jira API token is required"),
    project: import_zod.z.string().min(1, "Jira project key is required"),
    epic: import_zod.z.string().min(1, "Jira epic ID is required")
  }),
  dryRun: import_zod.z.boolean().default(false)
});
function loadConfig(options) {
  const config = {
    github: {
      token: process.env.GITHUB_TOKEN || "",
      owner: options.owner,
      repo: options.repo
    },
    jira: {
      host: process.env.JIRA_HOST || "",
      email: process.env.JIRA_EMAIL || "",
      apiToken: process.env.JIRA_API_TOKEN || "",
      project: options.project,
      epic: options.epic
    },
    dryRun: options.dryRun || false
  };
  return ConfigSchema.parse(config);
}

// src/github/client.ts
var import_rest = require("@octokit/rest");
function createGitHubClient(token) {
  return new import_rest.Octokit({
    auth: token,
    userAgent: "ghas-jira-sync/1.0.0"
  });
}

// src/jira/client.ts
var import_jira = require("jira.js");
function createJiraClient(config) {
  return new import_jira.Version3Client({
    host: config.host,
    authentication: {
      basic: {
        email: config.email,
        apiToken: config.apiToken
      }
    }
  });
}

// src/github/code-scanning.ts
async function fetchCodeScanningAlerts(octokit, owner, repo) {
  try {
    const { data } = await octokit.codeScanning.listAlertsForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100
    });
    return data.map((alert) => ({
      id: `code-scanning-${alert.number}`,
      type: "code-scanning",
      title: alert.rule.description || alert.rule.id || "Unknown rule",
      description: alert.rule.full_description || alert.rule.description || "",
      severity: mapCodeScanningSeverity(alert.rule.severity),
      state: mapCodeScanningState(alert.state || "open"),
      url: alert.html_url,
      createdAt: alert.created_at,
      location: alert.most_recent_instance?.location?.path
    }));
  } catch (error) {
    if (isAccessError(error)) {
      console.warn("Code scanning not available or not enabled for this repository");
      return [];
    }
    throw error;
  }
}
function mapCodeScanningSeverity(severity) {
  const severityMap = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
    warning: "warning",
    error: "error",
    note: "note"
  };
  return severityMap[severity?.toLowerCase() || ""] || "medium";
}
function mapCodeScanningState(state) {
  if (state === "open") return "open";
  if (state === "fixed") return "fixed";
  return "dismissed";
}
function isAccessError(error) {
  return typeof error === "object" && error !== null && "status" in error && (error.status === 404 || error.status === 403);
}

// src/github/dependabot.ts
async function fetchDependabotAlerts(octokit, owner, repo) {
  try {
    const { data } = await octokit.dependabot.listAlertsForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100
    });
    return data.map((alert) => {
      const cveId = alert.security_advisory.cve_id || alert.security_advisory.ghsa_id || void 0;
      const affectedVersions = alert.security_vulnerability?.vulnerable_version_range || void 0;
      const fixedVersions = alert.security_vulnerability?.first_patched_version?.identifier || void 0;
      return {
        id: `dependabot-${alert.number}`,
        type: "dependabot",
        title: `${alert.security_advisory.summary} in ${alert.dependency.package?.name || "unknown package"}`,
        description: alert.security_advisory.description,
        severity: mapDependabotSeverity(alert.security_advisory.severity),
        state: mapDependabotState(alert.state),
        url: alert.html_url,
        createdAt: alert.created_at,
        location: alert.dependency.manifest_path,
        cveId,
        affectedVersions,
        fixedVersions
      };
    });
  } catch (error) {
    if (isAccessError2(error)) {
      console.warn("Dependabot alerts not available or not enabled for this repository");
      return [];
    }
    throw error;
  }
}
function mapDependabotSeverity(severity) {
  const severityMap = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low"
  };
  return severityMap[severity.toLowerCase()] || "medium";
}
function mapDependabotState(state) {
  if (state === "open") return "open";
  if (state === "fixed") return "fixed";
  return "dismissed";
}
function isAccessError2(error) {
  return typeof error === "object" && error !== null && "status" in error && (error.status === 404 || error.status === 403);
}

// src/github/secret-scanning.ts
async function fetchSecretScanningAlerts(octokit, owner, repo) {
  try {
    const { data } = await octokit.secretScanning.listAlertsForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100
    });
    return data.map((alert) => ({
      id: `secret-scanning-${alert.number}`,
      type: "secret-scanning",
      title: `${alert.secret_type_display_name} exposed`,
      description: `Secret type: ${alert.secret_type}`,
      severity: "critical",
      state: mapSecretScanningState(alert.state || "open"),
      url: alert.html_url || "",
      createdAt: alert.created_at || (/* @__PURE__ */ new Date()).toISOString(),
      location: alert.locations_url
    }));
  } catch (error) {
    if (isAccessError3(error)) {
      console.warn("Secret scanning not available or not enabled for this repository");
      console.warn("Note: Secret scanning requires GitHub Advanced Security for private repos");
      console.warn('      and a token with "security_events" scope or "secret_scanning_alerts" permission');
      return [];
    }
    throw error;
  }
}
function mapSecretScanningState(state) {
  if (state === "open") return "open";
  if (state === "resolved") return "fixed";
  return "dismissed";
}
function isAccessError3(error) {
  return typeof error === "object" && error !== null && "status" in error && (error.status === 404 || error.status === 403);
}

// src/jira/tickets.ts
async function searchExistingTicket(client, projectKey, alertUrl, epicKey) {
  const alertLabel = createAlertLabel(alertUrl);
  console.log(`Searching for existing ticket with label: ${alertLabel}`);
  try {
    const jql = `project = ${projectKey} AND labels = "${alertLabel}" ORDER BY created DESC`;
    const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql,
      maxResults: 1,
      fields: ["summary", "description", "status", "labels"]
    });
    if (response.issues && response.issues.length > 0) {
      const issue = response.issues[0];
      if (issue) {
        return {
          id: issue.id,
          key: issue.key,
          fields: {
            summary: issue.fields.summary,
            description: typeof issue.fields.description === "string" ? issue.fields.description : "",
            status: {
              name: typeof issue.fields.status === "object" && issue.fields.status !== null && "name" in issue.fields.status ? String(issue.fields.status.name) : "Unknown"
            }
          }
        };
      }
    }
  } catch (error) {
    console.warn(`Label search failed for ${alertLabel}:`, error instanceof Error ? error.message : error);
    if (epicKey) {
      try {
        const epicJql = `project = ${projectKey} AND parent = ${epicKey} AND labels = "${alertLabel}" ORDER BY created DESC`;
        const epicResponse = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
          jql: epicJql,
          maxResults: 1,
          fields: ["summary", "description", "status", "labels"]
        });
        if (epicResponse.issues && epicResponse.issues.length > 0) {
          const issue = epicResponse.issues[0];
          if (issue) {
            return {
              id: issue.id,
              key: issue.key,
              fields: {
                summary: issue.fields.summary,
                description: typeof issue.fields.description === "string" ? issue.fields.description : "",
                status: {
                  name: typeof issue.fields.status === "object" && issue.fields.status !== null && "name" in issue.fields.status ? String(issue.fields.status.name) : "Unknown"
                }
              }
            };
          }
        }
      } catch (epicError) {
        console.warn(`Epic-based search also failed for ${alertLabel}:`, epicError instanceof Error ? epicError.message : epicError);
      }
    }
  }
  try {
    console.log(`Trying fallback URL-based search for: ${alertUrl}`);
    const urlSearchJql = `project = ${projectKey} AND text ~ "${alertUrl.replace(/[:"\/]/g, " ")}" ORDER BY created DESC`;
    const urlResponse = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql: urlSearchJql,
      maxResults: 5,
      fields: ["summary", "description", "status", "labels"]
    });
    if (urlResponse.issues && urlResponse.issues.length > 0) {
      for (const issue of urlResponse.issues) {
        const description = typeof issue.fields.description === "object" && issue.fields.description !== null ? JSON.stringify(issue.fields.description) : String(issue.fields.description || "");
        if (description.includes(alertUrl)) {
          console.log(`Found existing ticket via URL search: ${issue.key}`);
          return {
            id: issue.id,
            key: issue.key,
            fields: {
              summary: issue.fields.summary,
              description: typeof issue.fields.description === "string" ? issue.fields.description : "",
              status: {
                name: typeof issue.fields.status === "object" && issue.fields.status !== null && "name" in issue.fields.status ? String(issue.fields.status.name) : "Unknown"
              }
            }
          };
        }
      }
    }
  } catch (urlError) {
    console.warn(`URL-based search failed:`, urlError instanceof Error ? urlError.message : urlError);
  }
  return null;
}
async function createTicket(client, projectKey, epicKey, alert) {
  const description = buildTicketDescriptionADF(alert);
  const priority = mapSeverityToPriority(alert.severity);
  const alertLabel = createAlertLabel(alert.url);
  const labels = ["ghas", alert.type, `severity-${alert.severity}`, alertLabel];
  console.log(`Creating ticket with labels: ${labels.join(", ")}`);
  const payload = {
    fields: {
      project: {
        key: projectKey
      },
      summary: `[${alert.type.toUpperCase()}] ${alert.title}`,
      description,
      issuetype: {
        name: "Task"
      },
      priority: {
        name: priority
      },
      parent: {
        key: epicKey
      },
      labels
    }
  };
  try {
    const response = await client.issues.createIssue(payload);
    return response.key;
  } catch (error) {
    if (typeof error === "object" && error !== null && "response" in error) {
      const resp = error.response;
      console.error("Jira API Error Details:", JSON.stringify(resp.data, null, 2));
    }
    throw error;
  }
}
function parseMarkdownToADF(markdown) {
  const nodes = [];
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      nodes.push({
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: line.substring(4).trim() }]
      });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      nodes.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: line.substring(3).trim() }]
      });
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith("```")) {
        codeLines.push(lines[i] || "");
        i++;
      }
      if (codeLines.length > 0) {
        nodes.push({
          type: "codeBlock",
          content: [{ type: "text", text: codeLines.join("\n") }]
        });
      }
      i++;
      continue;
    }
    const paragraphContent = parseInlineFormatting(line);
    if (paragraphContent.length > 0) {
      nodes.push({
        type: "paragraph",
        content: paragraphContent
      });
    }
    i++;
  }
  return nodes;
}
function parseInlineFormatting(text) {
  const content = [];
  let currentPos = 0;
  const patterns = [
    { regex: /`([^`]+)`/g, type: "code" },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: "link" }
  ];
  const codeMatches = [...text.matchAll(/`([^`]+)`/g)];
  if (codeMatches.length === 0) {
    return [{ type: "text", text }];
  }
  let lastIndex = 0;
  for (const match of codeMatches) {
    const matchIndex = match.index || 0;
    if (matchIndex > lastIndex) {
      const beforeText = text.substring(lastIndex, matchIndex);
      if (beforeText) {
        content.push({ type: "text", text: beforeText });
      }
    }
    content.push({
      type: "text",
      text: match[1],
      marks: [{ type: "code" }]
    });
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      content.push({ type: "text", text: remainingText });
    }
  }
  return content.length > 0 ? content : [{ type: "text", text }];
}
function buildTicketDescriptionADF(alert) {
  const content = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Alert Type: ", marks: [{ type: "strong" }] },
        { type: "text", text: alert.type }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Severity: ", marks: [{ type: "strong" }] },
        { type: "text", text: alert.severity.toUpperCase() }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "State: ", marks: [{ type: "strong" }] },
        { type: "text", text: alert.state }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Created: ", marks: [{ type: "strong" }] },
        { type: "text", text: new Date(alert.createdAt).toLocaleString() }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Vulnerability Details", marks: [{ type: "strong" }] }
      ]
    }
  ];
  if (alert.cveId) {
    content.push({
      type: "paragraph",
      content: [
        { type: "text", text: "CVE ID: ", marks: [{ type: "strong" }] },
        { type: "text", text: alert.cveId }
      ]
    });
  }
  if (alert.affectedVersions) {
    content.push({
      type: "paragraph",
      content: [
        { type: "text", text: "Affected Versions: ", marks: [{ type: "strong" }] },
        { type: "text", text: alert.affectedVersions }
      ]
    });
  }
  if (alert.fixedVersions) {
    content.push({
      type: "paragraph",
      content: [
        { type: "text", text: "Fixed in Version: ", marks: [{ type: "strong" }] },
        { type: "text", text: alert.fixedVersions }
      ]
    });
  }
  const descriptionNodes = parseMarkdownToADF(alert.description);
  content.push(...descriptionNodes);
  if (alert.location) {
    content.push({
      type: "paragraph",
      content: [
        { type: "text", text: "Location: ", marks: [{ type: "strong" }] },
        { type: "text", text: alert.location }
      ]
    });
  }
  content.push(
    {
      type: "paragraph",
      content: [
        { type: "text", text: "GitHub Alert URL: ", marks: [{ type: "strong" }] }
      ]
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: alert.url }]
    },
    {
      type: "rule"
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "This ticket was automatically created by ghas-jira-sync",
          marks: [{ type: "em" }]
        }
      ]
    }
  );
  return {
    type: "doc",
    version: 1,
    content
  };
}
function mapSeverityToPriority(severity) {
  const priorityMap = {
    critical: "Highest",
    high: "High",
    error: "High",
    medium: "Medium",
    warning: "Medium",
    low: "Low",
    note: "Lowest"
  };
  return priorityMap[severity] || "Medium";
}
function createAlertLabel(alertUrl) {
  const match = alertUrl.match(/\/(dependabot|code-scanning|secret-scanning)\/(\d+)/);
  if (match) {
    const [, type, id] = match;
    return `ghas-${type}-${id}`;
  }
  const hash = alertUrl.split("/").slice(-2).join("-").replace(/[^a-zA-Z0-9-]/g, "");
  return `ghas-alert-${hash}`;
}

// src/sync/syncer.ts
async function syncAlerts(options) {
  const {
    githubClient,
    jiraClient,
    owner,
    repo,
    projectKey,
    epicKey,
    dryRun
  } = options;
  console.log(`
Fetching GHAS alerts for ${owner}/${repo}...`);
  const [codeScanningAlerts, dependabotAlerts, secretScanningAlerts] = await Promise.all([
    fetchCodeScanningAlerts(githubClient, owner, repo),
    fetchDependabotAlerts(githubClient, owner, repo),
    fetchSecretScanningAlerts(githubClient, owner, repo)
  ]);
  const allAlerts = [
    ...codeScanningAlerts,
    ...dependabotAlerts,
    ...secretScanningAlerts
  ];
  console.log(`Found ${allAlerts.length} total alerts:`);
  console.log(`  - Code Scanning: ${codeScanningAlerts.length}`);
  console.log(`  - Dependabot: ${dependabotAlerts.length}`);
  console.log(`  - Secret Scanning: ${secretScanningAlerts.length}`);
  const result = {
    totalAlerts: allAlerts.length,
    newTickets: 0,
    existingTickets: 0,
    skipped: 0,
    errors: 0
  };
  if (allAlerts.length === 0) {
    console.log("\nNo alerts to process.");
    return result;
  }
  console.log(`
${dryRun ? "[DRY RUN] " : ""}Processing alerts...`);
  for (const alert of allAlerts) {
    try {
      const existingTicket = await searchExistingTicket(
        jiraClient,
        projectKey,
        alert.url,
        epicKey
      );
      if (existingTicket) {
        console.log(
          `  \u2713 Ticket already exists for alert: ${alert.title} (${existingTicket.key})`
        );
        result.existingTickets++;
        continue;
      }
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
            `  \u2713 Created ticket ${ticketKey} for: ${alert.title} [${alert.severity}]`
          );
          result.newTickets++;
        } catch (createError) {
          console.error(
            `  \u2717 Error creating ticket for "${alert.title}":`,
            createError
          );
          result.errors++;
        }
      }
    } catch (error) {
      console.error(
        `  \u2717 Error processing alert "${alert.title}":`,
        error instanceof Error ? error.message : error
      );
      result.errors++;
    }
  }
  console.log("\n--- Sync Summary ---");
  console.log(`Total alerts: ${result.totalAlerts}`);
  console.log(`New tickets created: ${result.newTickets}`);
  console.log(`Existing tickets found: ${result.existingTickets}`);
  console.log(`Errors: ${result.errors}`);
  return result;
}

// src/index.ts
var isGitHubAction = !!process.env.GITHUB_ACTIONS;
async function runSync(options) {
  console.log("\u{1F504} Starting GHAS to Jira sync...\n");
  const config = loadConfig({
    owner: options.owner,
    repo: options.repo,
    epic: options.epic,
    project: options.project,
    dryRun: options.dryRun
  });
  const githubClient = createGitHubClient(config.github.token);
  const jiraClient = createJiraClient({
    host: config.jira.host,
    email: config.jira.email,
    apiToken: config.jira.apiToken
  });
  const result = await syncAlerts({
    githubClient,
    jiraClient,
    owner: config.github.owner,
    repo: config.github.repo,
    projectKey: config.jira.project,
    epicKey: config.jira.epic,
    dryRun: config.dryRun
  });
  const exitCode = result.errors > 0 ? 1 : 0;
  console.log("\n\u2705 Sync completed!");
  process.exit(exitCode);
}
if (isGitHubAction) {
  const getInput = (name) => {
    return process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`] || "";
  };
  const repository = process.env.GITHUB_REPOSITORY || "";
  const [contextOwner, contextRepo] = repository.split("/");
  const owner = getInput("owner") || contextOwner || "";
  const repo = getInput("repo") || contextRepo || "";
  const epic = getInput("jira-epic");
  const project = getInput("jira-project");
  const dryRun = getInput("dry-run") === "true";
  if (getInput("jira-host")) {
    process.env.JIRA_HOST = getInput("jira-host");
  }
  if (getInput("jira-email")) {
    process.env.JIRA_EMAIL = getInput("jira-email");
  }
  if (getInput("jira-api-token")) {
    process.env.JIRA_API_TOKEN = getInput("jira-api-token");
  }
  if (getInput("github-token")) {
    process.env.GITHUB_TOKEN = getInput("github-token");
  }
  runSync({ owner, repo, epic, project, dryRun }).catch((error) => {
    if (error instanceof Error) {
      console.error("\n\u274C Error:", error.message);
      if (error.stack) {
        console.error("\nStack trace:", error.stack);
      }
    } else {
      console.error("\n\u274C Unknown error:", error);
    }
    process.exit(1);
  });
} else {
  const program = new import_commander.Command();
  program.name("ghas-jira-sync").description("Sync GitHub Advanced Security alerts to Jira tickets").version("1.0.0").requiredOption("--owner <owner>", "GitHub organization or user").requiredOption("--repo <repo>", "GitHub repository name").requiredOption("--epic <epic>", "Jira epic ticket ID (e.g., PROJ-123)").requiredOption("--project <project>", "Jira project key (e.g., PROJ)").option("--dry-run", "Preview without creating tickets", false).action(async (options) => {
    try {
      await runSync({
        owner: options.owner,
        repo: options.repo,
        epic: options.epic,
        project: options.project,
        dryRun: options.dryRun
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error("\n\u274C Error:", error.message);
        if (error.stack) {
          console.error("\nStack trace:", error.stack);
        }
      } else {
        console.error("\n\u274C Unknown error:", error);
      }
      process.exit(1);
    }
  });
  program.parse();
}
//# sourceMappingURL=index.cjs.map