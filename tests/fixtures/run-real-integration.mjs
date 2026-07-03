import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";
const npxCommand = isWindows ? "npx.cmd" : "npx";

const statusResult = spawnSync(
  npxCommand,
  ["supabase", "status", "-o", "env"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: isWindows,
  },
);

if (statusResult.status !== 0) {
  process.stderr.write(statusResult.stderr || statusResult.stdout);
  process.stderr.write(
    "\nSupabase local no está disponible. Ejecuta `npx supabase start` primero.\n",
  );
  process.exit(statusResult.status ?? 1);
}

const localEnv = {};

for (const line of statusResult.stdout.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;

  const [, key, rawValue] = match;
  localEnv[key] = rawValue.replace(/^"|"$/g, "");
}

const apiUrl = localEnv.API_URL;
const anonKey = localEnv.ANON_KEY ?? localEnv.PUBLISHABLE_KEY;
const serviceRoleKey = localEnv.SERVICE_ROLE_KEY ?? localEnv.SECRET_KEY;

if (!apiUrl || !anonKey || !serviceRoleKey) {
  process.stderr.write(
    "No se pudieron resolver las credenciales de Supabase local.\n",
  );
  process.exit(1);
}

const vitestPath = path.resolve(
  process.cwd(),
  "node_modules",
  "vitest",
  "vitest.mjs",
);
const nextPath = path.resolve(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const backendUrl = "http://127.0.0.1:3198";
const runtimeEnv = {
  ...process.env,
  FRONTEND_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  SUPABASE_SERVICE_ROLE: serviceRoleKey,
};

let backendOutput = "";
const backend = spawn(
  process.execPath,
  [nextPath, "dev", "-H", "127.0.0.1", "-p", "3198"],
  {
    cwd: process.cwd(),
    env: runtimeEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

for (const stream of [backend.stdout, backend.stderr]) {
  stream.on("data", (chunk) => {
    backendOutput = (backendOutput + chunk.toString()).slice(-8_000);
  });
}

async function waitForBackend() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (backend.exitCode !== null) {
      throw new Error(`El backend terminó antes de iniciar.\n${backendOutput}`);
    }

    try {
      const response = await fetch(`${backendUrl}/api/lookups/juegos`);
      if (response.ok) return;
    } catch {
      // Next.js aún está iniciando o compilando la primera ruta.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`El backend no inició dentro de 60 segundos.\n${backendOutput}`);
}

let exitCode = 1;

try {
  await waitForBackend();

  const testResult = spawnSync(
    process.execPath,
    [
      vitestPath,
      "run",
      "--config",
      "vitest.real.config.ts",
      "tests/integration-real",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...runtimeEnv,
        LOCAL_BACKEND_URL: backendUrl,
        LOCAL_SUPABASE_ANON_KEY: anonKey,
        LOCAL_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        LOCAL_SUPABASE_URL: apiUrl,
      },
      stdio: "inherit",
    },
  );

  exitCode = testResult.status ?? 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
} finally {
  backend.kill();
}

process.exit(exitCode);
