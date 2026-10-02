import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps/web");
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";
const childEnvironment = { ...process.env };
delete childEnvironment.NO_COLOR;

function waitForExit(child) {
  return new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
}

async function waitForServer(server) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before E2E tests could start (code ${server.exitCode}).`);
    try {
      const response = await fetch(`${baseURL}/login`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Next.js is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for ${baseURL}.`);
}

function stopServer(server) {
  if (!server.pid || server.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  server.kill("SIGTERM");
}

async function runPlaywright() {
  const runner = spawn(
    process.execPath,
    [resolve(root, "node_modules/@playwright/test/cli.js"), "test", "--config", resolve(web, "playwright.config.ts")],
    { cwd: web, env: childEnvironment, stdio: "inherit", windowsHide: true },
  );
  return waitForExit(runner);
}

let server;
try {
  if (!process.env.E2E_BASE_URL) {
    server = spawn(
      process.execPath,
      [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3001"],
      { cwd: web, env: childEnvironment, stdio: "inherit", windowsHide: true },
    );
    await waitForServer(server);
  }

  process.exitCode = await runPlaywright();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (server) stopServer(server);
}

// Windows can retain handles from terminated Turbopack worker children. The
// server has already been stopped synchronously above, so exit cleanly instead
// of leaving local and CI E2E commands hanging after tests pass.
process.exit(process.exitCode ?? 0);
