import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./database-url.mjs";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  ...(process.env.DATABASE_URL ? { datasourceUrl: databaseUrl() } : {}),
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
