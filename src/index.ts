#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as tools from "./planeTools.js";

const server = new Server(
  { name: "websavvy-plane-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "plane_health_check",
        description: "Check connectivity to the configured Plane instance",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "plane_list_workspaces",
        description: "List all accessible Plane workspaces",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "plane_list_projects",
        description: "List all projects in a workspace",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
          },
          required: ["workspaceSlug"],
        },
      },
      {
        name: "plane_create_project",
        description: "Create a new project in a workspace",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
            name: { type: "string", description: "Project name" },
            identifier: { type: "string", description: "Short uppercase identifier (e.g. RCCG)" },
            description: { type: "string", description: "Project description" },
          },
          required: ["workspaceSlug", "name"],
        },
      },
      {
        name: "plane_list_issues",
        description: "List all work-items (issues) in a project",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
            projectId: { type: "string", description: "Project UUID" },
          },
          required: ["workspaceSlug", "projectId"],
        },
      },
      {
        name: "plane_create_issue",
        description: "Create a new work-item (issue) in a project",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
            projectId: { type: "string", description: "Project UUID" },
            title: { type: "string", description: "Issue title" },
            description: { type: "string", description: "Issue description" },
            priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"], description: "Priority" },
            stateName: { type: "string", description: "Exact state name to set" },
            assigneeEmail: { type: "string", description: "Assignee email address" },
            dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
          },
          required: ["workspaceSlug", "projectId", "title"],
        },
      },
      {
        name: "plane_update_issue",
        description: "Update an existing work-item",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
            projectId: { type: "string", description: "Project UUID" },
            issueId: { type: "string", description: "Issue UUID" },
            title: { type: "string", description: "New title" },
            description: { type: "string", description: "New description" },
            priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"], description: "Priority" },
            stateName: { type: "string", description: "Exact state name to move to" },
            assigneeEmail: { type: "string", description: "Assignee email address" },
            dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
          },
          required: ["workspaceSlug", "projectId", "issueId"],
        },
      },
      {
        name: "plane_delete_issue",
        description: "Delete a work-item",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
            projectId: { type: "string", description: "Project UUID" },
            issueId: { type: "string", description: "Issue UUID" },
          },
          required: ["workspaceSlug", "projectId", "issueId"],
        },
      },
      {
        name: "plane_list_users",
        description: "List all members in a workspace",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
          },
          required: ["workspaceSlug"],
        },
      },
      {
        name: "plane_list_states",
        description: "List all states in a project",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
            projectId: { type: "string", description: "Project UUID" },
          },
          required: ["workspaceSlug", "projectId"],
        },
      },
      {
        name: "plane_create_state",
        description: "Create a new state in a project",
        inputSchema: {
          type: "object" as const,
          properties: {
            workspaceSlug: { type: "string", description: "Workspace slug" },
            projectId: { type: "string", description: "Project UUID" },
            name: { type: "string", description: "State name" },
            group: { type: "string", enum: ["backlog", "unstarted", "started", "completed", "cancelled"], description: "State group" },
            color: { type: "string", description: "Hex color" },
          },
          required: ["workspaceSlug", "projectId", "name"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    let result: unknown;

    switch (name) {
      case "plane_health_check":
        result = await tools.healthCheck();
        break;
      case "plane_list_workspaces":
        result = await tools.listWorkspaces();
        break;
      case "plane_list_projects":
        result = await tools.listProjects(tools.ListProjectsInput.parse(args));
        break;
      case "plane_create_project":
        result = await tools.createProject(tools.CreateProjectInput.parse(args));
        break;
      case "plane_list_issues":
        result = await tools.listIssues(tools.ListIssuesInput.parse(args));
        break;
      case "plane_create_issue":
        result = await tools.createIssue(tools.CreateIssueInput.parse(args));
        break;
      case "plane_update_issue":
        result = await tools.updateIssue(tools.UpdateIssueInput.parse(args));
        break;
      case "plane_delete_issue": {
        const parsed = tools.DeleteIssueInput.parse(args);
        // Implement delete via generic fetch (planeApi doesn't export deleteIssue yet)
        const { config } = await import("./planeApi.js");
        const resp = await fetch(
          `${config.baseUrl}/api/v1/workspaces/${parsed.workspaceSlug}/projects/${parsed.projectId}/work-items/${parsed.issueId}/`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              ...(config.authMode === "api-key" ? { "X-API-Key": config.token } : {}),
              ...(config.authMode === "bearer" ? { Authorization: `Bearer ${config.token}` } : {}),
            },
          }
        );
        if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
        result = { deleted: true, issueId: parsed.issueId };
        break;
      }
      case "plane_list_users":
        result = await tools.listUsers(tools.ListUsersInput.parse(args));
        break;
      case "plane_list_states":
        result = await tools.listStates(tools.ListStatesInput.parse(args));
        break;
      case "plane_create_state":
        result = await tools.createState(tools.CreateStateInput.parse(args));
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, details: error.errors ?? undefined }, null, 2) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WebSavvy Plane MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
