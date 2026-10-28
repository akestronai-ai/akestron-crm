import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { defaultStages } from "../lib/default-stages.mjs";
import { normalizeEmail, normalizeProfileUrl } from "../lib/lead-identity.mjs";

const version = "202610280001_postgresql";
const sql = readFileSync(new URL(`../prisma/migrations/${version}/migration.sql`, import.meta.url), "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
const authVersion = "202610280002_auth_lead_identity";
const authSql = readFileSync(new URL(`../prisma/migrations/${authVersion}/migration.sql`, import.meta.url), "utf8");
const authChecksum = createHash("sha256").update(authSql).digest("hex");
const remindersVersion = "202610280003_stage_reminders";
const remindersSql = readFileSync(new URL(`../prisma/migrations/${remindersVersion}/migration.sql`, import.meta.url), "utf8");
const remindersChecksum = createHash("sha256").update(remindersSql).digest("hex");
const businessTables = ["pipelines", "pipeline_stages", "leads", "lead_activities"];
const legacyTables = ["lead_activities", "leads", "pipeline_stages", "pipelines", "warmup_settings", "workspace_preferences", "workspace_invites", "workspace_members", "workspaces"];

// Call within a single transaction. The small adapter also lets the exact
// upgrade run against isolated PostgreSQL in tests without a remote database.
export async function applyDatabaseMigration({ execute, query }) {
  await query("SELECT pg_advisory_xact_lock(62810428)::text");
  await execute('SET LOCAL TIME ZONE \'UTC\'');
  await execute('CREATE TABLE IF NOT EXISTS "_crm_migrations" (id text PRIMARY KEY, checksum text NOT NULL, "appliedAt" timestamptz NOT NULL DEFAULT now())');
  const applied = await query('SELECT checksum FROM "_crm_migrations" WHERE id = $1', [version]);
  const baselineApplied = applied.length > 0;
  if (baselineApplied && applied[0].checksum !== checksum) throw new Error("The applied migration was modified. Restore it before migrating.");
  const legacy = !baselineApplied && (await query("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pipelines' AND column_name = 'workspaceId'")).length > 0;
  const existing = (await query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipelines'")).length > 0;
  if (existing && !baselineApplied && !legacy) throw new Error("Unrecognized CRM schema. No changes were applied.");
  const counts = {};
  if (legacy) {
    // Transaction-local copies retain every business record while replacing
    // the old constraints, policies, triggers, and workspace columns.
    for (const table of [...businessTables, "warmup_settings"]) {
      await execute(`CREATE TEMP TABLE "crm_backup_${table}" ON COMMIT DROP AS TABLE public."${table}"`);
      counts[table] = Number((await query(`SELECT count(*) AS count FROM "crm_backup_${table}"`))[0].count);
    }
    for (const table of legacyTables) await execute(`DROP TABLE public."${table}"`);
    for (const signature of ["ensure_workspace()", "accept_workspace_invite(uuid)", "create_pipeline(uuid,text,text,jsonb,boolean)", "increment_follow_up(uuid,uuid)", "is_workspace_member(uuid)", "is_workspace_owner(uuid)", "track_lead_change()", "stamp_updated_at()"]) {
      await execute(`DROP FUNCTION IF EXISTS public.${signature}`);
    }
  }
  // The generated baseline contains ordinary DDL, with no procedural bodies.
  if (!baselineApplied) for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await execute(statement);
  if (legacy) {
    for (const table of businessTables) {
      const columns = await query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table]);
      const list = columns.map(c => `"${c.column_name}"`).join(", ");
      await execute(`INSERT INTO public."${table}" (${list}) SELECT ${list} FROM "crm_backup_${table}"`);
      const restored = Number((await query(`SELECT count(*) AS count FROM public."${table}"`))[0].count);
      if (restored !== counts[table]) throw new Error("Record preservation check failed. The transaction will be rolled back.");
    }
    // A single shared schedule replaces workspace schedules. Retain the earliest
    // start date if upgrading a database that previously had multiple workspaces.
    await execute('INSERT INTO "warmup_settings" (id, "startDate", "updatedAt") SELECT \'default\', min("startDate")::text, max("updatedAt") FROM "crm_backup_warmup_settings" HAVING count(*) > 0');
  }
  // Hosted PostgreSQL may grant REST roles access through default privileges.
  // Those roles are not used by this app; keep the new tables server-only.
  for (const role of ["anon", "authenticated"]) {
    if ((await query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).length) {
      await execute(`REVOKE ALL ON "pipelines", "pipeline_stages", "leads", "lead_activities", "warmup_settings" FROM "${role}"`);
    }
  }
  if (!baselineApplied) await execute('INSERT INTO "warmup_settings" (id, "startDate", "updatedAt") VALUES (\'default\', CURRENT_DATE::text, now()) ON CONFLICT (id) DO NOTHING');
  if (!baselineApplied && Number((await query('SELECT count(*) AS count FROM "pipelines"'))[0].count) === 0) {
    const pipelineId = randomUUID();
    await execute('INSERT INTO "pipelines" (id, name, description, "isDefault", "updatedAt") VALUES ($1::uuid, $2, $3, true, now())', [pipelineId, "Musa & Abdullah Acquisition Pipeline", "Shared customer acquisition"]);
    for (const [i, stage] of defaultStages.entries()) {
      await execute('INSERT INTO "pipeline_stages" (id, "pipelineId", name, "order", color) VALUES ($1::uuid, $2::uuid, $3, $4, $5)', [randomUUID(), pipelineId, stage.name, i + 1, stage.color]);
    }
  }
  if (!baselineApplied) await execute('INSERT INTO "_crm_migrations" (id, checksum) VALUES ($1, $2)', [version, checksum]);
  const authApplied = await query('SELECT checksum FROM "_crm_migrations" WHERE id = $1', [authVersion]);
  if (authApplied.length && authApplied[0].checksum !== authChecksum) throw new Error("The applied migration was modified. Restore it before migrating.");
  if (!authApplied.length) {
    for (const statement of authSql.split(";").map(s => s.trim()).filter(Boolean)) await execute(statement);
    for (const role of ["anon", "authenticated"]) {
      if ((await query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).length) await execute(`REVOKE ALL ON "app_users", "app_sessions", "auth_attempts" FROM "${role}"`);
    }
    const leads = await query('SELECT id, email, "profileUrl" FROM leads');
    const emails = new Map(); const profiles = new Map();
    for (const lead of leads) {
      const emailKey = normalizeEmail(lead.email); const profileKey = normalizeProfileUrl(lead.profileUrl);
      for (const [map, key, kind] of [[emails, emailKey, "email"], [profiles, profileKey, "profile"]]) {
        if (key && map.has(key)) throw new Error(`Existing ${kind} identity collision found. Resolve it before applying the identity migration.`);
        if (key) map.set(key, lead.id);
      }
      if (emailKey || profileKey) await execute('UPDATE leads SET "emailKey"=$1, "profileKey"=$2 WHERE id=$3', [emailKey, profileKey, lead.id]);
    }
    await execute('INSERT INTO "_crm_migrations" (id, checksum) VALUES ($1, $2)', [authVersion, authChecksum]);
  }
  const remindersApplied = await query('SELECT checksum FROM "_crm_migrations" WHERE id = $1', [remindersVersion]);
  if (remindersApplied.length && remindersApplied[0].checksum !== remindersChecksum) throw new Error("The applied migration was modified. Restore it before migrating.");
  const alreadyUpToDate = baselineApplied && authApplied.length > 0 && remindersApplied.length > 0;
  let remindersWereApplied = remindersApplied.length > 0;
  if (!remindersWereApplied) {
    for (const statement of remindersSql.split(";").map(s => s.trim()).filter(Boolean)) await execute(statement);
    for (const role of ["anon", "authenticated"]) {
      if ((await query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).length) await execute(`REVOKE ALL ON "lead_reminders" FROM "${role}"`);
    }
    await execute('INSERT INTO "_crm_migrations" (id, checksum) VALUES ($1, $2)', [remindersVersion, remindersChecksum]);
    remindersWereApplied = true;
  }
  return { alreadyApplied: alreadyUpToDate, upgradedLegacySchema: legacy, preserved: counts };
}
