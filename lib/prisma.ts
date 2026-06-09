import { PrismaClient } from "@prisma/client";
import { assertDatabaseEnv } from "@/lib/env";

assertDatabaseEnv();

function withPrismaConnectionLimit(value: string | undefined) {
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
    return value;
  }
}

process.env.DATABASE_URL = withPrismaConnectionLimit(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
