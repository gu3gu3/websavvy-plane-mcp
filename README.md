# WebSavvy Plane MCP Server

Model Context Protocol server that exposes **Plane.so** (self-hosted or cloud) as tools for AI agents and assistants.

## Features

- **Workspaces**: List accessible workspaces  
- **Projects**: List, create  
- **Issues / Work-items**: List, create, update, delete  
- **States**: List, create custom states  
- **Members**: List workspace users  
- **Health check**: Validate connectivity  
- **Type-safe schemas**: Zod validation on every tool input  
- **Stdio transport**: Works with Claude Desktop, Claude Code, Cursor, or any MCP client  

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
```

## Usage

### Run directly

```bash
npm start
```

Or via npx (after publishing):

```bash
npx websavvy-plane-mcp
```

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
        "PLANE_WORKSPACE_SLUGS": "inversion-morales-tablada"
      }
    }
  }
}
```

### Using the inspector

```bash
npm run inspector
```

This opens the MCP Inspector UI to manually test tools.

## Available Tools

| Tool | Description |
|------|-------------|
| `plane_health_check` | Validate Plane API connectivity |
| `plane_list_workspaces` | List all accessible workspaces |
| `plane_list_projects` | List projects in a workspace |
| `plane_create_project` | Create a new project |
| `plane_list_issues` | List work-items in a project |
| `plane_create_issue` | Create a new work-item |
| `plane_update_issue` | Update an existing work-item |
| `plane_delete_issue` | Delete a work-item |
| `plane_list_users` | List workspace members |
| `plane_list_states` | List project states |
| `plane_create_state` | Create a new custom state |

## Tool Examples

### Create a work-item

```json
{
  "name": "plane_create_issue",
  "arguments": {
    "workspaceSlug": "inversion-morales-tablada",
    "projectId": "8c6d25d9-6af2-4787-959b-04129fcbc907",
    "title": "Revisar contrato de compra",
    "description": "Validar cláusulas fiscales y registrales",
    "priority": "high",
    "stateName": "En proceso",
    "assigneeEmail": "usuario@condorgold.com",
    "dueDate": "2026-05-15"
  }
}
```

### Update work-item state

```json
{
  "name": "plane_update_issue",
  "arguments": {
    "workspaceSlug": "inversion-morales-tablada",
    "projectId": "8c6d25d9-6af2-4787-959b-04129fcbc907",
    "issueId": "...",
    "stateName": "Seleccionado",
    "priority": "urgent"
  }
}
```

## Project Structure

```
mcp/
├── src/
│   ├── index.ts        # MCP server entry (StdioServerTransport)
│   ├── planeApi.ts     # Plane API HTTP client
│   ├── planeTools.ts   # Zod schemas + tool handlers
│   ├── types.ts        # TypeScript types
│   └── test.ts         # Quick integration test script
├── dist/               # Compiled output
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Architecture

- **planeApi.ts**: Pure HTTP client using `fetch`. Reads env vars for auth. Normalizes Plane responses into stable objects.
- **planeTools.ts**: Zod schemas for every tool + handler functions. Resolves state names and emails into IDs automatically.
- **index.ts**: MCP Server wiring. JSON-RPC over stdio.

## Error Handling

- API errors return `isError: true` with JSON content
- Zod validation errors include the list of validation failures
- Network errors bubble with status codes and body preview

## Docker

Build:

```bash
docker build -t websavvy-plane-mcp .
```

Run:

```bash
docker run --rm -it \
  -e PLANE_BASE_URL=https://projects.websavvy-solutions.com \
  -e PLANE_API_TOKEN=plane_api_your_token \
  websavvy-plane-mcp
```

## Testing

```bash
npm run build
node dist/test.js
```

## Next Steps / Roadmap

- [ ] SSE transport option (`MCP_TRANSPORT=sse`)
- [ ] Bulk operations (create multiple issues, bulk update, bulk delete)
- [ ] Workflow templates execution
- [ ] Project member management
- [ ] Labels and custom fields support
- [ ] OAuth2 / refresh token flow
- [ ] Rate-limit awareness and retry logic
- [ ] Publish to npm as `@websavvy/plane-mcp`

## License

MIT © WebSavvy Solutions
