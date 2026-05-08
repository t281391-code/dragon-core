import { spawnSync } from "node:child_process";

const TRANSIENT_DB_ERROR_PATTERN =
  /Too many connections|P2037|P1001|Can't reach database server|ECONNRESET|ETIMEDOUT|timeout|timed out|Schema engine error/i;

const env = {
  ...process.env,
  DATABASE_URL: withPrismaConnectionLimit(process.env.DATABASE_URL),
};

function withPrismaConnectionLimit(value) {
  if (!value) return value;

  try {
    const url = new URL(value);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }
    return url.toString();
  } catch {
    console.warn("Could not add Prisma connection limits to DATABASE_URL; using the original value.");
    return value;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactSecrets(text) {
  return text.replace(/mysql:\/\/([^:]+):([^@]+)@/gi, "mysql://$1:***@");
}

async function runStep(label, command, args, options = {}) {
  const retries = options.retries ?? 3;
  const allowFailure = options.allowFailure ?? false;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    console.log(`\n[vercel-build] ${label} (${attempt}/${retries})`);
    const result = spawnSync(command, args, {
      env,
      shell: process.platform === "win32",
      encoding: "utf8",
    });

    if (result.stdout) process.stdout.write(redactSecrets(result.stdout));
    if (result.stderr) process.stderr.write(redactSecrets(result.stderr));

    if (result.status === 0) return;

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const canRetry = TRANSIENT_DB_ERROR_PATTERN.test(output) && attempt < retries;
    if (canRetry) {
      const waitMs = attempt * 12000;
      console.warn(`[vercel-build] Transient database connection error. Retrying in ${waitMs / 1000}s...`);
      await sleep(waitMs);
      continue;
    }

    if (allowFailure) {
      console.warn(`[vercel-build] Ignoring failure for optional step: ${label}`);
      return;
    }

    process.exit(result.status || 1);
  }
}

console.log("[vercel-build] Running Prisma with connection_limit=1 and pool_timeout=30.");

await runStep(
  "Recover failed shift migration marker",
  "npx",
  ["prisma", "migrate", "resolve", "--rolled-back", "20260507000100_add_shift_participants_and_overtime"],
  { allowFailure: true, retries: 5 },
);

await runStep("Apply database migrations", "npx", ["prisma", "migrate", "deploy"], { retries: 5 });
await runStep("Seed database defaults", "npx", ["prisma", "db", "seed"], { retries: 5 });
await runStep("Build Next.js app", "npm", ["run", "build"], { retries: 1 });
