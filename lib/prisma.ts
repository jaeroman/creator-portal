import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  return url;
}

// Pooled connection: Prisma 7 talks to Postgres through a driver adapter, so
// the app gets Neon's pooler while the CLI keeps the direct URL for migrations.
function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString() }),
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Without this, every dev hot reload would open another connection pool.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
