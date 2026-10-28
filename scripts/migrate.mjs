import "./load-env.mjs";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "../lib/database-url.mjs";
import { applyDatabaseMigration } from "./database-migration.mjs";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const db = new PrismaClient({ datasourceUrl: databaseUrl() });
try {
  const result = await db.$transaction(tx => applyDatabaseMigration({
    execute: (sql, params = []) => tx.$executeRawUnsafe(sql, ...params),
    query: (sql, params = []) => tx.$queryRawUnsafe(sql, ...params),
  }), { timeout: 60000, maxWait: 15000 });
  console.log(result.alreadyApplied ? "PostgreSQL schema is already up to date." : "PostgreSQL schema migrated successfully.");
  if (result.preserved) console.log("Business records preserved:", result.preserved);
} catch (error) {
  // Prisma connection errors can contain credentials or host information.
  console.error("Migration failed; transaction rolled back.", error.code || "Check the connection and database schema.");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
