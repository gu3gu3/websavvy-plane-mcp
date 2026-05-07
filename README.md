# WebSavvy Plane MCP Server

Model Context Protocol server that exposes **Plane.so** (self-hosted or cloud) as tools for AI agents and assistants.

Supports **stdio** and **SSE** transports.

## Features

- **Workspaces**: List accessible workspaces
- **Projects**: List, create
- **Issues / Work-items**: List, create, create batch (bulk), update, bulk update, delete, bulk delete
- **States**: List, create custom states
- **Members**: List workspace users, list project members, add/remove project members
- **Health check**: Validate connectivity
- **Type-safe schemas**: Zod validation on every tool input
- **Dual transport**: `stdio` (default) for Claude Desktop, `sse` for HTTP clients
- **Bulk operations**: Create up to 50 issues at once, bulk update/delete multiple issues

## Prerequisites

- Node.js 22+
- A Plane.so instance (self-hosted or cloud)
- A Plane API token (Personal Access Token)

## Installation

```bash
git clone https://github.com/gu3gu3/websavvy-plane-mcp.git
cd websavvy-plane-mcp
npm install
npm run build
```

## Configuration

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PLANE_BASE_URL=https://projects.websavvy-solutions.com
PLANE_API_TOKEN=plane_api_your_token_here
PLANE_AUTH_MODE=api-key
PLANE_WORKSPACE_SLUGS=inversion-morales-tablada
PLANE_HEALTH_WORKSPACE_SLUG=inversion-morales-tablada

# Transport: stdio | sse
MCP_TRANSPORT=stdio
MCP_PORT=3001
```

## Usage

### Stdio mode (default)

```bash
npm start
# or
MCP_TRANSPORT=stdio node dist/index.js
```

### SSE mode (HTTP)

```bash
npm run start:sse
# or
MCP_TRANSPORT=sse MCP_PORT=3001 node dist/index.js
```

Endpoints:
- `GET http://localhost:3001/sse` — Establish SSE stream
- `POST http://localhost:3001/messages?sessionId=<id>` — Send JSON-RPC messages

### With Claude Desktop (MCP config)

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "plane": {
      "command": "node",
      "args": ["/path/to/mcp/dist/index.js"],
      "env": {
        "PLANE_BASE_URL": "https://projects.websavvy-solutions.com",
        "PLANE_API_TOKEN": "plane_api_your_token_here",
        "PLANE_AUTH_MODE": "api-key",
        "PLANE_WORKSPACE_SLUGS": "inversion-morales-tablada",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Using the inspector

```bash
npm run inspector
```

## Available Tools (17)

| Tool | Description |
|------|-------------|
| `plane_health_check` | Validate Plane API connectivity |
| `plane_list_workspaces` | List all accessible workspaces |
| `plane_list_projects` | List projects in a workspace |
| `plane_create_project` | Create a new project |
| `plane_list_issues` | List work-items in a project |
| `plane_create_issue` | Create a new work-item |
| `plane_create_issues_batch` | **Bulk create** up to 50 work-items at once |
| `plane_update_issue` | Update an existing work-item |
| `plane_bulk_update_issues` | **Bulk update** multiple issues (state, priority, assignee, due date) |
| `plane_delete_issue` | Delete a work-item |
| `plane_bulk_delete_issues` | **Bulk delete** multiple work-items |
| `plane_list_users` | List workspace members |
| `plane_list_project_members` | List members assigned to a project |
| `plane_add_project_member` | Add a workspace member to a project |
| `plane_remove_project_member` | Remove a member from a project |
| `plane_list_states` | List project states |
| `plane_create_state` | Create a new custom state |

## Tool Examples

### Bulk create issues (recruitment workflow)

```json
{
  "name": "plane_create_issues_batch",
  "arguments": {
    "workspaceSlug": "condor-gold",
    "projectId": "2e460cb1-7acf-454d-bc05-1da222a6df71",
    "items": [
      { "title": "Definir perfil de plazas de jefatura", "priority": "high", "stateName": "En proceso", "dueDate": "2026-05-09" },
      { "title": "Publicar plazas de jefatura", "priority": "high", "stateName": "En proceso", "dueDate": "2026-05-10" },
      { "title": "Filtrar candidatos para jefaturas", "priority": "high", "dueDate": "2026-05-14" }
    ]
  }
}
```

### Bulk update issue state

```json
{
  "name": "plane_bulk_update_issues",
  "arguments": {
    "workspaceSlug": "inversion-morales-tablada",
    "projectId": "8c6d25d9-6af2-4787-959b-04129fcbc907",
    "issueIds": ["id1", "id2", "id3"],
    "stateName": "In Progress",
    "priority": "high"
  }
}
```

### Add member to project

```json
{
  "name": "plane_add_project_member",
  "arguments": {
    "workspaceSlug": "condor-gold",
    "projectId": "2e460cb1-7acf-454d-bc05-1da222a6df71",
    "memberId": "92dfbb74-4f52-463c-8ca9-5dafd1151402",
    "role": 15
  }
}
```

## Project Structure

```
mcp/
├── src/
│   ├── index.ts        # MCP server (stdio + SSE transports)
│   ├── planeApi.ts     # Plane API HTTP client
│   ├── planeTools.ts   # Zod schemas + tool handlers
│   ├── types.ts        # TypeScript types
│   ├── test.ts         # Basic stdio test
│   └── test-full.ts    # Full integration test
├── dist/               # Compiled output
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
└── README.md
```

## Architecture

- **planeApi.ts**: Pure HTTP client using `fetch`. Reads env vars for auth. Normalizes Plane responses.
- **planeTools.ts**: Zod schemas for every tool + handler functions. Resolves state names and emails into IDs automatically.
- **index.ts**: MCP Server. Supports both `StdioServerTransport` and `SSEServerTransport` via `MCP_TRANSPORT` env var.

## Error Handling

- API errors return `isError: true` with JSON content
- Zod validation errors include the list of validation failures
- Network errors bubble with status codes and body preview
- Bulk operations report individual item errors without failing the entire batch

## Docker

Build:

```bash
docker build -t websavvy-plane-mcp .
```

Run stdio:

```bash
docker run --rm -it \
  -e PLANE_BASE_URL=https://projects.websavvy-solutions.com \
  -e PLANE_API_TOKEN=plane_api_your_token \
  websavvy-plane-mcp
```

Run SSE:

```bash
docker run --rm -p 3001:3001 \
  -e MCP_TRANSPORT=sse \
  -e MCP_PORT=3001 \
  -e PLANE_API_TOKEN=plane_api_your_token \
  websavvy-plane-mcp
```

## Testing

```bash
npm run build
npm test
```

## Next Steps / Roadmap

- [x] SSE transport
- [x] Bulk create issues
- [x] Bulk update issues
- [x] Bulk delete issues
- [x] Project member management
- [ ] Workflow templates execution
- [ ] Labels and custom fields support
- [ ] OAuth2 / refresh token flow
- [ ] Rate-limit awareness and retry logic
- [ ] Publish to npm as `@websavvy/plane-mcp`

## License

MIT © WebSavvy Solutions
