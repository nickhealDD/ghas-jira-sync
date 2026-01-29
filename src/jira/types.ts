export interface JiraTicketFields {
  project: {
    key: string;
  };
  summary: string;
  description: string;
  issuetype: {
    name: string;
  };
  priority?: {
    name: string;
  };
  parent?: {
    key: string;
  };
  labels?: string[];
}

export interface CreateTicketPayload {
  fields: JiraTicketFields;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
  };
}
