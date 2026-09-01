import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// The Prisma CLI does not read .env.local the way Next.js does.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env.local prisma/seed.ts",
  },
  // Prisma 7 dropped datasource.directUrl. The CLI uses this URL, so it gets
  // Neon's unpooled endpoint, which migrations require. Runtime queries go
  // through the pooled URL in the driver adapter (lib/prisma.ts).
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
