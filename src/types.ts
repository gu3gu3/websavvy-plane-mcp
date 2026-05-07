export type AuthMode = "api-key" | "bearer" | "session";

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

export type Workspace = {
  id: string;
  slug: string;
  name: string;
};

export type Project = {
  id: string;
  workspaceSlug: string;
  name: string;
  identifier?: string;
  description?: string;
};

export type ProjectInput = {
  name: string;
  identifier?: string;
  description?: string;
};

export type User = {
  id: string;
  displayName: string;
  email?: string;
};

export type State = {
  id: string;
  name: string;
  group?: string;
  color?: string;
  projectId?: string;
};

export type Issue = {
  id: string;
  projectId: string;
  workspaceSlug: string;
  sequenceId?: number;
  title: string;
  description?: string;
  statusId?: string;
  statusName: string;
  priority: Priority;
  assigneeIds: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
};

export type IssueInput = {
  title: string;
  description?: string;
  statusId?: string;
  priority?: Priority;
  assigneeIds?: string[];
  dueDate?: string;
};

export type PlaneConfig = {
  baseUrl: string;
  token: string;
  authMode: AuthMode;
  workspaceSlugs: string[];
  healthWorkspaceSlug?: string;
};
