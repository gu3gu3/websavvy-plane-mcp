#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as tools from "./planeTools.js";

const server = new Server(
  { name: "websavvy-plane-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

// ── Tool List ─────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: "plane_health_check",
    description: "Check connectivity to the configured Plane instance",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "plane_list_workspaces",
    description: "List all accessible Plane workspaces",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "plane_list_projects",
    description: "List all projects in a workspace",
    inputSchema: { type: "object" as const, properties: { workspaceSlug: { type: "string" } }, required: ["workspaceSlug"] },
  },
  {
    name: "plane_create_project",
    description: "Create a new project in a workspace",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        name: { type: "string" },
        identifier: { type: "string", description: "Short uppercase identifier (e.g. RCCG)" },
        description: { type: "string" },
      },
      required: ["workspaceSlug", "name"],
    },
  },
  {
    name: "plane_list_issues",
    description: "List all work-items (issues) in a project",
    inputSchema: { type: "object" as const, properties: { workspaceSlug: { type: "string" }, projectId: { type: "string" } }, required: ["workspaceSlug", "projectId"] },
  },
  {
    name: "plane_create_issue",
    description: "Create a new work-item (issue) in a project. Resolves state names and assignee emails to IDs automatically.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        projectId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"] },
        stateName: { type: "string", description: "Exact state name to set" },
        assigneeEmail: { type: "string", description: "Assignee email address" },
        dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
      },
      required: ["workspaceSlug", "projectId", "title"],
    },
  },
  {
    name: "plane_create_issues_batch",
    description: "Create multiple work-items at once (bulk create). Max 50 items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        projectId: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"] },
              stateName: { type: "string" },
              assigneeEmail: { type: "string" },
              dueDate: { type: "string" },
            },
            required: ["title"],
          },
        },
      },
      required: ["workspaceSlug", "projectId", "items"],
    },
  },
  {
    name: "plane_update_issue",
    description: "Update an existing work-item. Only provide fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        projectId: { type: "string" },
        issueId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"] },
        stateName: { type: "string", description: "Exact state name to move to" },
        assigneeEmail: { type: "string", description: "Assignee email address" },
        dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
      },
      required: ["workspaceSlug", "projectId", "issueId"],
    },
  },
  {
    name: "plane_bulk_update_issues",
    description: "Bulk update multiple issues at once (move state, change priority, reassign, update due date)",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        projectId: { type: "string" },
        issueIds: { type: "array", items: { type: "string" } },
        stateName: { type: "string" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"] },
        assigneeEmail: { type: "string" },
        dueDate: { type: "string" },
      },
      required: ["workspaceSlug", "projectId", "issueIds"],
    },
  },
  {
    name: "plane_delete_issue",
    description: "Delete a work-item permanently",
    inputSchema: { type: "object" as const, properties: { workspaceSlug: { type: "string" }, projectId: { type: "string" }, issueId: { type: "string" } }, required: ["workspaceSlug", "projectId", "issueId"] },
  },
  {
    name: "plane_bulk_delete_issues",
    description: "Permanently delete multiple work-items at once",
    inputSchema: { type: "object" as const, properties: { workspaceSlug: { type: "string" }, projectId: { type: "string" }, issueIds: { type: "array", items: { type: "string" } } }, required: ["workspaceSlug", "projectId", "issueIds"] },
  },
  {
    name: "plane_list_users",
    description: "List all members in a workspace",
    inputSchema: { type: "object" as const, properties: { workspaceSlug: { type: "string" } }, required: ["workspaceSlug"] },
  },
  {
    name: "plane_list_project_members",
    description: "List all members assigned to a project",
    inputSchema: { type: "object" as const, properties: { workspaceSlug: { type: "string" }, projectId: { type: "string" } }, required: ["workspaceSlug", "projectId"] },
  },
  {
    name: "plane_add_project_member",
    description: "Add a workspace member to a project",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        projectId: { type: "string" },
        memberId: { type: "string", description: "Workspace user UUID" },
        role: { type: "number", description: "5=Guest, 10=Viewer, 15=Member, 20=Admin", default: 15 },
      },
      required: ["workspaceSlug", "projectId", "memberId"],
    },
  },
  {
    name: "plane_remove_project_member",
    description: "Remove a member from a project by membership ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        projectId: { type: "string" },
        membershipId: { type: "string", description: "The membership record ID (not user ID)" },
      },
      required: ["workspaceSlug", "projectId", "membershipId"],
    },
  },
  {
    name: "plane_list_states",
    description: "List all states (statuses) in a project",
    inputSchema: { type: "object" as const, properties: { workspaceSlug: { type: "string" }, projectId: { type: "string" } }, required: ["workspaceSlug", "projectId"] },
  },
  {
    name: "plane_create_state",
    description: "Create a new custom state in a project",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceSlug: { type: "string" },
        projectId: { type: "string" },
        name: { type: "string" },
        group: { type: "string", enum: ["backlog", "unstarted", "started", "completed", "cancelled"] },
        color: { type: "string", description: "Hex color" },
      },
      required: ["workspaceSlug", "projectId", "name"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));

// ── Tool Dispatcher ──────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    let result: unknown;

    switch (name) {
      case "plane_health_check": result = await tools.healthCheck(); break;
      case "plane_list_workspaces": result = await tools.listWorkspaces(); break;
      case "plane_list_projects": result = await tools.listProjects(tools.ListProjectsInput.parse(args)); break;
      case "plane_create_project": result = await tools.createProject(tools.CreateProjectInput.parse(args)); break;
      case "plane_list_issues": result = await tools.listIssues(tools.ListIssuesInput.parse(args)); break;
      case "plane_create_issue": result = await tools.createIssue(tools.CreateIssueInput.parse(args)); break;
      case "plane_create_issues_batch": result = await tools.createIssuesBatch(tools.CreateIssuesBatchInput.parse(args)); break;
      case "plane_update_issue": result = await tools.updateIssue(tools.UpdateIssueInput.parse(args)); break;
      case "plane_bulk_update_issues": result = await tools.bulkUpdateIssues(tools.BulkUpdateIssuesInput.parse(args)); break;
      case "plane_delete_issue": result = await tools.deleteIssue(tools.DeleteIssueInput.parse(args)); break;
      case "plane_bulk_delete_issues": result = await tools.bulkDeleteIssues(tools.BulkDeleteIssuesInput.parse(args)); break;
      case "plane_list_users": result = await tools.listUsers(tools.ListUsersInput.parse(args)); break;
      case "plane_list_project_members": result = await tools.listProjectMembers(tools.ListProjectMembersInput.parse(args)); break;
      case "plane_add_project_member": result = await tools.addProjectMember(tools.AddProjectMemberInput.parse(args)); break;
      case "plane_remove_project_member": result = await tools.removeProjectMember(tools.RemoveProjectMemberInput.parse(args)); break;
      case "plane_list_states": result = await tools.listStates(tools.ListStatesInput.parse(args)); break;
      case "plane_create_state": result = await tools.createState(tools.CreateStateInput.parse(args)); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, details: error.errors ?? undefined }, null, 2) }], isError: true };
  }
});

// ── Transport Selection ──────────────────────────────────

const transportMode = process.env.MCP_TRANSPORT ?? "stdio";
const port = parseInt(process.env.MCP_PORT ?? "3001", 10);

async function main() {
  if (transportMode === "sse") {
    const http = await import("node:http");
    const { URL } = await import("node:url");

    const transports = new Map<string, SSEServerTransport>();

    const serverHttp = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (url.pathname === "/sse") {
        const transport = new SSEServerTransport("/messages", res);
        transports.set(transport.sessionId, transport);
        res.on("close", () => transports.delete(transport.sessionId));
        await server.connect(transport);
        console.error(`SSE client connected: ${transport.sessionId}`);
      } else if (url.pathname === "/messages") {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId || !transports.has(sessionId)) {
          res.statusCode = 404;
          res.end("Session not found");
          return;
        }
        const transport = transports.get(sessionId)!;
        await transport.handlePostMessage(req, res);
      } else {
        res.statusCode = 404;
        res.end("Not found");
      }
    });

    serverHttp.listen(port, () => {
      console.error(`WebSavvy Plane MCP Server (SSE) running on http://localhost:${port}`);
      console.error(`  SSE endpoint:    http://localhost:${port}/sse`);
      console.error(`  Messages POST:   http://localhost:${port}/messages?sessionId=<id>`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("WebSavvy Plane MCP Server (stdio) running");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
