#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = {
  ...process.env,
  PLANE_API_TOKEN: "plane_api_19a932ee1e22401b8cd24bc72bbb1302",
  PLANE_BASE_URL: "https://projects.websavvy-solutions.com",
  PLANE_WORKSPACE_SLUGS: "inversion-morales-tablada",
  PLANE_HEALTH_WORKSPACE_SLUG: "inversion-morales-tablada",
  PLANE_AUTH_MODE: "api-key",
};

const mcp = spawn("node", [join(__dirname, "index.js")], {
  env,
  stdio: ["pipe", "pipe", "inherit"],
});

function send(req: unknown) {
  const line = JSON.stringify(req) + "\n";
  mcp.stdin!.write(line);
}

function recv(): Promise<unknown> {
  return new Promise((resolve) => {
    mcp.stdout!.once("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.result || msg.error) {
            resolve(msg);
            return;
          }
        } catch { /* ignore */ }
      }
      resolve(null);
    });
  });
}

async function callTool(name: string, args: Record<string, unknown>) {
  send({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } });
  return recv();
}

async function main() {
  console.log("[test] Initializing...\n");

  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } });
  await recv();

  // 1. Health
  console.log("=== 1. Health Check ===");
  const health = await callTool("plane_health_check", {});
  console.log(JSON.stringify((health as any)?.result?.content?.[0]?.text ?? health, null, 2));

  // 2. List workspaces
  console.log("\n=== 2. List Workspaces ===");
  const ws = await callTool("plane_list_workspaces", {});
  console.log(JSON.stringify((ws as any)?.result?.content?.[0]?.text ?? ws, null, 2));

  // 3. List projects
  console.log("\n=== 3. List Projects ===");
  const proj = await callTool("plane_list_projects", { workspaceSlug: "inversion-morales-tablada" });
  console.log(JSON.stringify((proj as any)?.result?.content?.[0]?.text ?? proj, null, 2));

  // 4. List users
  console.log("\n=== 4. List Users ===");
  const users = await callTool("plane_list_users", { workspaceSlug: "inversion-morales-tablada" });
  console.log(JSON.stringify((users as any)?.result?.content?.[0]?.text ?? users, null, 2));

  // 5. List issues in first project
  console.log("\n=== 5. List Issues ===");
  try {
    const issues = await callTool("plane_list_issues", { workspaceSlug: "inversion-morales-tablada", projectId: "8c6d25d9-6af2-4787-959b-04129fcbc907" });
    console.log(JSON.stringify((issues as any)?.result?.content?.[0]?.text ?? issues, null, 2));
  } catch (e: any) {
    console.log("Error:", e.message);
  }

  // 6. List states
  console.log("\n=== 6. List States ===");
  try {
    const states = await callTool("plane_list_states", { workspaceSlug: "inversion-morales-tablada", projectId: "8c6d25d9-6af2-4787-959b-04129fcbc907" });
    console.log(JSON.stringify((states as any)?.result?.content?.[0]?.text ?? states, null, 2));
  } catch (e: any) {
    console.log("Error:", e.message);
  }

  mcp.kill();
  console.log("\n[test] All tests completed.");
}

main().catch((err) => {
  console.error("[test] Error:", err);
  mcp.kill();
  process.exit(1);
});
