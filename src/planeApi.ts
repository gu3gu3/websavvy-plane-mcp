import type { PlaneConfig, Workspace, Project, ProjectInput, Issue, IssueInput, State, User } from "./types.js";

function loadConfig(): PlaneConfig {
  const baseUrl = (process.env.PLANE_BASE_URL ?? "https://projects.websavvy-solutions.com").replace(/\/$/, "");
  const token = process.env.PLANE_API_TOKEN ?? "";
  const authMode = (process.env.PLANE_AUTH_MODE ?? "api-key") as PlaneConfig["authMode"];
  const workspaceSlugs = (process.env.PLANE_WORKSPACE_SLUGS || process.env.PLANE_HEALTH_WORKSPACE_SLUG || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const healthWorkspaceSlug = process.env.PLANE_HEALTH_WORKSPACE_SLUG;
  return { baseUrl, token, authMode, workspaceSlugs, healthWorkspaceSlug };
}

function authHeaders(config: PlaneConfig): Record<string, string> {
  const h: Record<string, string> = {};
  if (config.authMode === "api-key") h["X-API-Key"] = config.token;
  if (config.authMode === "bearer") h["Authorization"] = `Bearer ${config.token}`;
  return h;
}

export const config = loadConfig();

async function planeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(config),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Plane API ${response.status}: ${text.slice(0, 500)}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as T;
}

type PlaneList<T> = T[] | { results?: T[]; workspaces?: T[] };
function unwrapList<T>(value: PlaneList<T>): T[] {
  return Array.isArray(value) ? value : value.results ?? value.workspaces ?? [];
}

const apiPrefix = "/api/v1";

export async function getWorkspaces(): Promise<Workspace[]> {
  if (config.authMode === "api-key" || config.authMode === "bearer") {
    return config.workspaceSlugs.map((slug) => ({
      id: slug,
      slug,
      name: slug
        .split("-")
        .filter(Boolean)
        .map((p) => p[0]?.toUpperCase() + p.slice(1))
        .join(" "),
    }));
  }
  const data = await planeFetch<PlaneList<Record<string, unknown>>>(`${apiPrefix}/users/me/workspaces/`);
  return unwrapList(data).map((item) => {
    const ws = (item.workspace as Record<string, unknown> | undefined) ?? item;
    return {
      id: String(ws.id ?? item.workspace_id ?? ws.slug ?? ws.name),
      slug: String(ws.slug ?? item.workspace_slug ?? ws.name ?? ws.id),
      name: String(ws.name ?? ws.slug ?? "Workspace"),
    };
  });
}

export async function getProjects(workspaceSlug: string): Promise<Project[]> {
  const data = await planeFetch<PlaneList<Record<string, unknown>>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/`
  );
  return unwrapList(data).map((item) => ({
    id: String(item.id),
    workspaceSlug,
    name: String(item.name ?? "Untitled project"),
    identifier: item.identifier ? String(item.identifier) : undefined,
    description: item.description ? String(item.description) : undefined,
  }));
}

export async function createProject(workspaceSlug: string, payload: ProjectInput): Promise<Project> {
  const data = await planeFetch<Record<string, unknown>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/`,
    {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        identifier: payload.identifier,
        description: payload.description ?? "",
      }),
    }
  );
  return {
    id: String(data.id),
    workspaceSlug,
    name: String(data.name ?? "Untitled project"),
    identifier: data.identifier ? String(data.identifier) : undefined,
    description: data.description ? String(data.description) : undefined,
  };
}

export async function getIssues(workspaceSlug: string, projectId: string): Promise<Issue[]> {
  const data = await planeFetch<PlaneList<Record<string, unknown>>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/work-items/`
  );
  return unwrapList(data).map((item) => {
    const assignees = item.assignees ?? item.assignee_ids ?? [];
    const st = item.state as Record<string, unknown> | undefined;
    return {
      id: String(item.id),
      workspaceSlug,
      projectId,
      sequenceId: typeof item.sequence_id === "number" ? item.sequence_id : undefined,
      title: String(item.name ?? item.title ?? "Untitled task"),
      description: item.description_html
        ? String(item.description_html)
        : item.description
          ? String(item.description)
          : "",
      statusId: item.state_id ? String(item.state_id) : st?.id ? String(st.id) : undefined,
      statusName: st?.name ? String(st.name) : item.statusName ? String(item.statusName) : "Unsorted",
      priority: (item.priority as Issue["priority"]) ?? "none",
      assigneeIds: Array.isArray(assignees) ? assignees.map(String) : [],
      dueDate: item.target_date ? String(item.target_date) : item.due_date ? String(item.due_date) : undefined,
      createdAt: item.created_at ? String(item.created_at) : new Date().toISOString(),
      updatedAt: item.updated_at ? String(item.updated_at) : undefined,
    };
  });
}

export async function createIssue(workspaceSlug: string, projectId: string, payload: IssueInput): Promise<Issue> {
  const body = {
    name: payload.title,
    description_html: payload.description ?? "",
    priority: payload.priority ?? "none",
    state: payload.statusId,
    assignees: payload.assigneeIds ?? [],
    target_date: payload.dueDate || null,
  };
  const data = await planeFetch<Record<string, unknown>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/work-items/`,
    { method: "POST", body: JSON.stringify(body) }
  );
  const assignees = data.assignees ?? data.assignee_ids ?? [];
  const st = data.state as Record<string, unknown> | undefined;
  return {
    id: String(data.id),
    workspaceSlug,
    projectId,
    sequenceId: typeof data.sequence_id === "number" ? data.sequence_id : undefined,
    title: String(data.name ?? data.title ?? "Untitled task"),
    description: data.description_html
      ? String(data.description_html)
      : data.description
        ? String(data.description)
        : "",
    statusId: data.state_id ? String(data.state_id) : st?.id ? String(st.id) : undefined,
    statusName: st?.name ? String(st.name) : data.statusName ? String(data.statusName) : "Unsorted",
    priority: (data.priority as Issue["priority"]) ?? "none",
    assigneeIds: Array.isArray(assignees) ? assignees.map(String) : [],
    dueDate: data.target_date ? String(data.target_date) : data.due_date ? String(data.due_date) : undefined,
    createdAt: data.created_at ? String(data.created_at) : new Date().toISOString(),
    updatedAt: data.updated_at ? String(data.updated_at) : undefined,
  };
}

export async function updateIssue(
  workspaceSlug: string,
  projectId: string,
  issueId: string,
  payload: IssueInput
): Promise<Issue> {
  const body: Record<string, unknown> = {
    name: payload.title,
    description_html: payload.description ?? "",
    priority: payload.priority ?? "none",
    state: payload.statusId,
    assignees: payload.assigneeIds ?? [],
    target_date: payload.dueDate || null,
  };
  const data = await planeFetch<Record<string, unknown>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${issueId}/`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  const assignees = data.assignees ?? data.assignee_ids ?? [];
  const st = data.state as Record<string, unknown> | undefined;
  return {
    id: String(data.id),
    workspaceSlug,
    projectId,
    sequenceId: typeof data.sequence_id === "number" ? data.sequence_id : undefined,
    title: String(data.name ?? data.title ?? "Untitled task"),
    description: data.description_html
      ? String(data.description_html)
      : data.description
        ? String(data.description)
        : "",
    statusId: data.state_id ? String(data.state_id) : st?.id ? String(st.id) : undefined,
    statusName: st?.name ? String(st.name) : data.statusName ? String(data.statusName) : "Unsorted",
    priority: (data.priority as Issue["priority"]) ?? "none",
    assigneeIds: Array.isArray(assignees) ? assignees.map(String) : [],
    dueDate: data.target_date ? String(data.target_date) : data.due_date ? String(data.due_date) : undefined,
    createdAt: data.created_at ? String(data.created_at) : new Date().toISOString(),
    updatedAt: data.updated_at ? String(data.updated_at) : undefined,
  };
}

function normalizeUser(item: Record<string, unknown>): User {
  const member =
    (item.member as Record<string, unknown> | undefined) ??
    (item.member_details as Record<string, unknown> | undefined) ??
    (item.user as Record<string, unknown> | undefined) ??
    item;
  const firstName = String(member.first_name ?? "");
  const lastName = String(member.last_name ?? "");
  return {
    id: String(member.id ?? item.id),
    displayName: String(
      member.display_name ?? `${firstName} ${lastName}`.trim() ?? member.email ?? "User"
    ),
    email: member.email ? String(member.email) : undefined,
  };
}

export async function getUsers(workspaceSlug: string): Promise<User[]> {
  const data = await planeFetch<PlaneList<Record<string,unknown>>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/members/`
  );
  return unwrapList(data).map(normalizeUser);
}

export async function getStates(workspaceSlug: string, projectId: string): Promise<State[]> {
  const data = await planeFetch<PlaneList<Record<string, unknown>>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/states/`
  );
  const states = unwrapList(data).map((item) => ({
    id: String(item.id),
    name: String(item.name ?? "Unknown"),
    group: item.group ? String(item.group) : undefined,
    color: item.color ? String(item.color) : undefined,
    projectId: item.project_id ? String(item.project_id) : undefined,
  }));
  const projectStates = states.filter((s) => !s.projectId || s.projectId === projectId);
  return projectStates.length > 0 ? projectStates : states;
}

export async function createState(
  workspaceSlug: string,
  projectId: string,
  payload: { name: string; group: string; color: string }
): Promise<State> {
  const data = await planeFetch<Record<string, unknown>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/states/`,
    { method: "POST", body: JSON.stringify(payload) }
  );
  return {
    id: String(data.id),
    name: String(data.name ?? "Unknown"),
    group: data.group ? String(data.group) : undefined,
    color: data.color ? String(data.color) : undefined,
    projectId: data.project_id ? String(data.project_id) : undefined,
  };
}

export async function addProjectMember(
  workspaceSlug: string,
  projectId: string,
  memberId: string,
  role = 15
): Promise<{ id: string; member: string; role: number }> {
  return planeFetch(`${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/members/`, {
    method: "POST",
    body: JSON.stringify({ member: memberId, role }),
  });
}

export async function removeProjectMember(
  workspaceSlug: string,
  projectId: string,
  membershipId: string
): Promise<void> {
  await planeFetch(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/members/${membershipId}/`,
    { method: "DELETE" }
  );
}

export async function getProjectMembers(workspaceSlug: string, projectId: string): Promise<User[]> {
  const data = await planeFetch<PlaneList<Record<string, unknown>>>(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/members/`
  );
  return unwrapList(data).map(normalizeUser);
}

export async function deleteIssue(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
  await planeFetch(
    `${apiPrefix}/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${issueId}/`,
    { method: "DELETE" }
  );
}

export async function healthCheck(): Promise<{ ok: boolean; message: string }> {
  try {
    await planeFetch<unknown>(`${apiPrefix}/users/me/`);
    if (config.healthWorkspaceSlug) {
      await planeFetch<unknown>(`${apiPrefix}/workspaces/${config.healthWorkspaceSlug}/projects/`);
      return { ok: true, message: `Connected to Plane at ${config.baseUrl}` };
    }
    return { ok: true, message: `Connected to Plane at ${config.baseUrl}` };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}
