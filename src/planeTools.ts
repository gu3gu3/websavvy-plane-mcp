import { z } from "zod";
import * as planeApi from "./planeApi.js";

// ── Schemas ───────────────────────────────────────────────

export const WorkspaceSlugSchema = z.string().min(1).describe("The workspace slug (e.g. 'inversion-morales-tablada')");

export const ProjectIdSchema = z.string().uuid().describe("The project UUID");

export const IssueIdSchema = z.string().uuid().describe("The work-item/issue UUID");

export const PrioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]).describe("Issue priority");

export const ListWorkspacesInput = z.object({}).describe("List all accessible workspaces");

export const ListProjectsInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
}).describe("List all projects in a workspace");

export const CreateProjectInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  name: z.string().min(1),
  identifier: z.string().min(1).max(5).optional(),
  description: z.string().optional(),
}).describe("Create a new project in a workspace");

export const ListIssuesInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  projectId: ProjectIdSchema,
}).describe("List all work-items in a project");

export const GetIssueInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  projectId: ProjectIdSchema,
  issueId: IssueIdSchema,
}).describe("Get details of a specific work-item");

export const CreateIssueInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  priority: PrioritySchema.default("medium"),
  stateName: z.string().optional().describe("Exact state name (e.g. 'En proceso', 'Todo'). Optional."),
  assigneeEmail: z.string().email().optional().describe("Assignee email. Optional."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Due date in YYYY-MM-DD format"),
}).describe("Create a new work-item in a project");

export const UpdateIssueInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  projectId: ProjectIdSchema,
  issueId: IssueIdSchema,
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: PrioritySchema.optional(),
  stateName: z.string().optional().describe("Exact state name to move the issue to"),
  assigneeEmail: z.string().email().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).describe("Update an existing work-item");

export const DeleteIssueInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  projectId: ProjectIdSchema,
  issueId: IssueIdSchema,
}).describe("Delete a work-item");

export const ListUsersInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
}).describe("List all workspace members");

export const ListStatesInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  projectId: ProjectIdSchema,
}).describe("List all states in a project");

export const CreateStateInput = z.object({
  workspaceSlug: WorkspaceSlugSchema,
  projectId: ProjectIdSchema,
  name: z.string().min(1),
  group: z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]).default("started"),
  color: z.string().default("#3b82f6"),
}).describe("Create a new state in a project");

export const HealthCheckInput = z.object({}).describe("Check Plane API connectivity");

// ── Helpers ───────────────────────────────────────────────

async function resolveStateId(workspaceSlug: string, projectId: string, stateName?: string): Promise<string | undefined> {
  if (!stateName) return undefined;
  const states = await planeApi.getStates(workspaceSlug, projectId);
  const match = states.find((s) => s.name.toLowerCase().trim() === stateName.toLowerCase().trim());
  return match?.id;
}

async function resolveUserId(workspaceSlug: string, assigneeEmail?: string): Promise<string | undefined> {
  if (!assigneeEmail) return undefined;
  const users = await planeApi.getUsers(workspaceSlug);
  const match = users.find((u) => u.email?.toLowerCase() === assigneeEmail.toLowerCase());
  return match?.id;
}

// ── Tool Handlers ─────────────────────────────────────────

export async function listWorkspaces() {
  const workspaces = await planeApi.getWorkspaces();
  return {
    workspaces: workspaces.map((w) => ({ slug: w.slug, name: w.name })),
    count: workspaces.length,
  };
}

export async function listProjects(input: z.infer<typeof ListProjectsInput>) {
  const projects = await planeApi.getProjects(input.workspaceSlug);
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      identifier: p.identifier,
      description: p.description,
    })),
    count: projects.length,
  };
}

export async function createProject(input: z.infer<typeof CreateProjectInput>) {
  const project = await planeApi.createProject(input.workspaceSlug, {
    name: input.name,
    identifier: input.identifier,
    description: input.description,
  });
  return {
    id: project.id,
    name: project.name,
    identifier: project.identifier,
    workspaceSlug: project.workspaceSlug,
  };
}

export async function listIssues(input: z.infer<typeof ListIssuesInput>) {
  const issues = await planeApi.getIssues(input.workspaceSlug, input.projectId);
  return {
    issues: issues.map((i) => ({
      id: i.id,
      sequenceId: i.sequenceId,
      title: i.title,
      statusName: i.statusName,
      priority: i.priority,
      assigneeIds: i.assigneeIds,
      dueDate: i.dueDate,
    })),
    count: issues.length,
  };
}

export async function createIssue(input: z.infer<typeof CreateIssueInput>) {
  const [stateId, assigneeId] = await Promise.all([
    resolveStateId(input.workspaceSlug, input.projectId, input.stateName),
    resolveUserId(input.workspaceSlug, input.assigneeEmail),
  ]);

  const issue = await planeApi.createIssue(input.workspaceSlug, input.projectId, {
    title: input.title,
    description: input.description,
    priority: input.priority,
    statusId: stateId,
    assigneeIds: assigneeId ? [assigneeId] : undefined,
    dueDate: input.dueDate,
  });

  return {
    id: issue.id,
    sequenceId: issue.sequenceId,
    title: issue.title,
    statusName: issue.statusName,
    priority: issue.priority,
    assigneeIds: issue.assigneeIds,
    dueDate: issue.dueDate,
    url: `${planeApi.config.baseUrl}/${input.workspaceSlug}/projects/${input.projectId}/issues/${issue.id}`,
  };
}

export async function updateIssue(input: z.infer<typeof UpdateIssueInput>) {
  const [stateId, assigneeId] = await Promise.all([
    resolveStateId(input.workspaceSlug, input.projectId, input.stateName),
    resolveUserId(input.workspaceSlug, input.assigneeEmail),
  ]);

  const issue = await planeApi.updateIssue(input.workspaceSlug, input.projectId, input.issueId, {
    title: input.title ?? "",
    description: input.description,
    priority: input.priority,
    statusId: stateId,
    assigneeIds: assigneeId ? [assigneeId] : undefined,
    dueDate: input.dueDate,
  });

  return {
    id: issue.id,
    sequenceId: issue.sequenceId,
    title: issue.title,
    statusName: issue.statusName,
    priority: issue.priority,
    assigneeIds: issue.assigneeIds,
    dueDate: issue.dueDate,
  };
}

export async function listUsers(input: z.infer<typeof ListUsersInput>) {
  const users = await planeApi.getUsers(input.workspaceSlug);
  return {
    users: users.map((u) => ({ id: u.id, displayName: u.displayName, email: u.email })),
    count: users.length,
  };
}

export async function listStates(input: z.infer<typeof ListStatesInput>) {
  const states = await planeApi.getStates(input.workspaceSlug, input.projectId);
  return {
    states: states.map((s) => ({ id: s.id, name: s.name, group: s.group, color: s.color })),
    count: states.length,
  };
}

export async function createState(input: z.infer<typeof CreateStateInput>) {
  const state = await planeApi.createState(input.workspaceSlug, input.projectId, {
    name: input.name,
    group: input.group,
    color: input.color,
  });
  return { id: state.id, name: state.name, group: state.group, color: state.color };
}

export async function healthCheck() {
  const result = await planeApi.healthCheck();
  return result;
}
