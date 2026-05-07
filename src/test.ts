#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env if available
function loadEnv() {
  const envPath = join(__dirname, "../.env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

const mcp = spawn("node", [join(__dirname, "index.js")], {
  env: { ...process.env },
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
        } catch {
          // ignore non-JSON lines
        }
      }
      resolve(null);
    });
  });
}

async function main() {
  console.log("[test] Initializing MCP server...\n");

  // Initialize
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
  });
  await recv();

  // List tools
  send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });
  const toolsResp = await recv() as { result?: { tools?: Array<{ name: string; description: string }> } };
  console.log("[test] Available tools (" + (toolsResp.result?.tools?.length ?? 0) + "):");
  for (const tool of toolsResp.result?.tools ?? []) {
    console.log(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
  }

  // Health check
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "plane_health_check", arguments: {} },
  });
  const health = await recv();
  console.log("\n[test] Health check result:");
  const healthResult = (health as any)?.result?.content?.[0]?.text;
  if (healthResult) {
    try { console.log(JSON.stringify(JSON.parse(healthResult), null, 2)); }
    catch { console.log(healthResult); }
  }

  // Close
  mcp.kill();
  console.log("\n[test] Done.");
}

main().catch((err) => {
  console.error("[test] Error:", err);
  mcp.kill();
  process.exit(1);
});
