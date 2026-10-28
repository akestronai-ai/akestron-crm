import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { applyDatabaseMigration } from "../scripts/database-migration.mjs";

process.env.TZ = "UTC";

async function migrate(db) {
  return db.transaction(tx => applyDatabaseMigration({
    execute: (sql, params = []) => tx.query(sql, params),
    query: async (sql, params = []) => (await tx.query(sql, params)).rows,
  }));
}
async function count(db, table) {
  return Number((await db.query(`SELECT count(*) AS count FROM "${table}"`)).rows[0].count);
}

test("fresh PostgreSQL schema, seeds, constraints, and idempotent migration", async () => {
  const db = new PGlite();
  try {
    assert.equal((await migrate(db)).alreadyApplied, false);
    assert.equal(await count(db, "pipelines"), 1);
    assert.equal(await count(db, "pipeline_stages"), 8);
    assert.equal(await count(db, "warmup_settings"), 1);
    assert.equal((await migrate(db)).alreadyApplied, true);
    const [{ id: pipelineId }] = (await db.query('SELECT id FROM pipelines')).rows;
    const [{ id: stageId }] = (await db.query('SELECT id FROM pipeline_stages LIMIT 1')).rows;
    const otherPipeline = randomUUID();
    const otherStage = randomUUID();
    await db.query('INSERT INTO pipelines (id,name,"updatedAt") VALUES ($1,\'Other\',now())', [otherPipeline]);
    await db.query('INSERT INTO pipeline_stages (id,"pipelineId",name,"order") VALUES ($1,$2,\'Other stage\',1)', [otherStage, otherPipeline]);
    const leadId = randomUUID();
    await db.query('INSERT INTO leads (id,"pipelineId","stageId",name,"updatedAt") VALUES ($1,$2,$3,\'Lead\',now())', [leadId, pipelineId, stageId]);
    await assert.rejects(db.query('UPDATE leads SET "stageId" = $1 WHERE id = $2', [otherStage, leadId]), /foreign key/i);
    await assert.rejects(db.query('UPDATE leads SET "dealValue" = -1 WHERE id = $1', [leadId]), /check constraint/i);
    await assert.rejects(db.query('UPDATE leads SET "followUpCount" = -1 WHERE id = $1', [leadId]), /check constraint/i);
    await db.query('INSERT INTO lead_activities (id,"leadId",content) VALUES ($1,$2,\'Note\')', [randomUUID(), leadId]);
    await db.query('DELETE FROM pipeline_stages WHERE id = $1', [stageId]);
    assert.equal(await count(db, "leads"), 0);
    assert.equal(await count(db, "lead_activities"), 0);
    await db.exec('DELETE FROM pipelines');
    await migrate(db);
    assert.equal(await count(db, "pipelines"), 0, "a deleted pipeline must not be reseeded");
  } finally { await db.close(); }
});

async function legacyFixture(db) {
  // Reconstruct the previous workspace-owned table shape without connecting
  // to any hosted service or relying on the removed authentication schema.
  const baseline = readFileSync(new URL("../prisma/migrations/202610280001_postgresql/migration.sql", import.meta.url), "utf8");
  await db.exec(baseline);
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    CREATE TABLE workspaces (id uuid PRIMARY KEY, name text);
    CREATE TABLE workspace_members ("workspaceId" uuid REFERENCES workspaces, "userId" uuid, PRIMARY KEY ("workspaceId", "userId"));
    CREATE TABLE workspace_preferences ("userId" uuid, "workspaceId" uuid, FOREIGN KEY ("workspaceId", "userId") REFERENCES workspace_members);
    CREATE TABLE workspace_invites (id uuid PRIMARY KEY, "workspaceId" uuid REFERENCES workspaces);
    ALTER TABLE pipelines ADD COLUMN "workspaceId" uuid REFERENCES workspaces;
    ALTER TABLE pipeline_stages ADD COLUMN "workspaceId" uuid REFERENCES workspaces;
    ALTER TABLE leads ADD COLUMN "workspaceId" uuid REFERENCES workspaces;
    ALTER TABLE lead_activities ADD COLUMN "workspaceId" uuid REFERENCES workspaces;
    DROP TABLE warmup_settings;
    CREATE TABLE warmup_settings ("workspaceId" uuid PRIMARY KEY REFERENCES workspaces, "startDate" date NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now());
    CREATE FUNCTION is_workspace_member(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    CREATE POLICY member_access ON leads USING (is_workspace_member("workspaceId"));
    CREATE FUNCTION track_lead_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE TRIGGER lead_history AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION track_lead_change();
  `);
  const workspaceId = randomUUID();
  const pipelineId = randomUUID();
  const stageId = randomUUID();
  const leadId = randomUUID();
  const activityId = randomUUID();
  await db.query('INSERT INTO workspaces VALUES ($1,\'Existing\')', [workspaceId]);
  await db.query('INSERT INTO pipelines (id,name,"updatedAt","workspaceId") VALUES ($1,\'Existing pipeline\',now(),$2)', [pipelineId, workspaceId]);
  await db.query('INSERT INTO pipeline_stages (id,"pipelineId",name,"order","workspaceId") VALUES ($1,$2,\'Existing stage\',1,$3)', [stageId, pipelineId, workspaceId]);
  await db.query('INSERT INTO leads (id,"pipelineId","stageId",name,"followUpCount",notes,"updatedAt","workspaceId") VALUES ($1,$2,$3,\'Existing lead\',7,\'Keep this note\',now(),$4)', [leadId, pipelineId, stageId, workspaceId]);
  await db.query('INSERT INTO lead_activities (id,"leadId",content,"workspaceId") VALUES ($1,$2,\'Existing activity\',$3)', [activityId, leadId, workspaceId]);
  await db.query('INSERT INTO warmup_settings ("workspaceId","startDate") VALUES ($1,\'2026-10-01\')', [workspaceId]);
  return { workspaceId, pipelineId, stageId, leadId, activityId };
}

test("legacy upgrade preserves business records and removes workspace dependencies", async () => {
  const db = new PGlite();
  try {
    const ids = await legacyFixture(db);
    const before = (await db.query('SELECT "createdAt" FROM leads WHERE id = $1', [ids.leadId])).rows[0].createdAt;
    const result = await migrate(db);
    assert.equal(result.upgradedLegacySchema, true);
    assert.equal(await count(db, "pipelines"), 1);
    assert.equal(await count(db, "pipeline_stages"), 1);
    const [lead] = (await db.query('SELECT * FROM leads WHERE id = $1', [ids.leadId])).rows;
    assert.equal(lead.notes, "Keep this note");
    assert.equal(lead.followUpCount, 7);
    assert.equal(lead.createdAt.toISOString(), before.toISOString());
    assert.equal(lead.pipelineId, ids.pipelineId);
    assert.equal(lead.stageId, ids.stageId);
    assert.equal((await db.query('SELECT id FROM lead_activities')).rows[0].id, ids.activityId);
    assert.equal((await db.query('SELECT "startDate" FROM warmup_settings WHERE id = \'default\'')).rows[0].startDate, "2026-10-01");
    assert.equal((await db.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'workspace%'")).rows.length, 0);
    assert.equal((await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND column_name='workspaceId'")).rows.length, 0);
    assert.equal((await db.query("SELECT 1 FROM pg_policies WHERE schemaname='public'")).rows.length, 0);
    assert.equal((await db.query("SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname IN ('is_workspace_member','track_lead_change')")).rows.length, 0);
    assert.equal((await db.query("SELECT has_table_privilege('anon','leads','SELECT') AS allowed")).rows[0].allowed, false);
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','leads','UPDATE') AS allowed")).rows[0].allowed, false);
    assert.equal((await migrate(db)).alreadyApplied, true);
  } finally { await db.close(); }
});

test("unexpected dependencies roll back the entire upgrade", async () => {
  const db = new PGlite();
  try {
    const ids = await legacyFixture(db);
    await db.exec('CREATE TABLE unrelated_data ("workspaceId" uuid REFERENCES workspaces)');
    await assert.rejects(migrate(db), /depend/i);
    assert.equal(await count(db, "workspaces"), 1);
    assert.equal(await count(db, "leads"), 1);
    assert.equal((await db.query('SELECT notes FROM leads WHERE id=$1', [ids.leadId])).rows[0].notes, "Keep this note");
    assert.equal((await db.query("SELECT to_regclass('public._crm_migrations') AS table_name")).rows[0].table_name, null);
  } finally { await db.close(); }
});

test("identity migration stops on canonical duplicate emails and rolls back safely", async () => {
  const db = new PGlite();
  try {
    const baseline = readFileSync(new URL("../prisma/migrations/202610280001_postgresql/migration.sql", import.meta.url), "utf8");
    await db.exec(baseline);
    const checksum = createHash("sha256").update(baseline).digest("hex");
    await db.exec('CREATE TABLE "_crm_migrations" (id text PRIMARY KEY, checksum text NOT NULL, "appliedAt" timestamptz NOT NULL DEFAULT now())');
    await db.query('INSERT INTO "_crm_migrations" (id,checksum) VALUES ($1,$2)', ["202610280001_postgresql", checksum]);
    const pipelineId = randomUUID(); const stageId = randomUUID();
    await db.query('INSERT INTO pipelines (id,name,"updatedAt") VALUES ($1,\'Existing\',now())', [pipelineId]);
    await db.query('INSERT INTO pipeline_stages (id,"pipelineId",name,"order") VALUES ($1,$2,\'Stage\',1)', [stageId, pipelineId]);
    for (const [id, email] of [[randomUUID(), " Person@Example.test "], [randomUUID(), "person@example.test"]]) {
      await db.query('INSERT INTO leads (id,"pipelineId","stageId",name,email,"updatedAt") VALUES ($1,$2,$3,\'Existing lead\',$4,now())', [id, pipelineId, stageId, email]);
    }
    await assert.rejects(migrate(db), /Existing email identity collision/);
    assert.equal(await count(db, "leads"), 2);
    assert.equal((await db.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='app_users'")).rows.length, 0);
    assert.equal((await db.query('SELECT count(*) AS count FROM "_crm_migrations"')).rows[0].count, 1);
  } finally { await db.close(); }
});

test("stage reminder migration backfills the latest stage change without replacing records", async () => {
  const db = new PGlite();
  try {
    const baseline = readFileSync(new URL("../prisma/migrations/202610280001_postgresql/migration.sql", import.meta.url), "utf8");
    await db.exec(baseline);
    const checksum = createHash("sha256").update(baseline).digest("hex");
    await db.exec('CREATE TABLE "_crm_migrations" (id text PRIMARY KEY, checksum text NOT NULL, "appliedAt" timestamptz NOT NULL DEFAULT now())');
    await db.query('INSERT INTO "_crm_migrations" (id,checksum) VALUES ($1,$2)', ["202610280001_postgresql", checksum]);
    const pipelineId = randomUUID(); const stageId = randomUUID(); const leadId = randomUUID(); const legacyLeadId = randomUUID(); const activityId = randomUUID();
    const createdAt = new Date("2025-01-02T03:04:05.000Z");
    const stageChangedAt = new Date("2025-02-03T04:05:06.000Z");
    await db.query('INSERT INTO pipelines (id,name,"updatedAt") VALUES ($1,\'Keep pipeline\',now())', [pipelineId]);
    await db.query('INSERT INTO pipeline_stages (id,"pipelineId",name,"order") VALUES ($1,$2,\'Keep stage\',1)', [stageId, pipelineId]);
    await db.query('INSERT INTO leads (id,"pipelineId","stageId",name,notes,"createdAt","updatedAt") VALUES ($1,$2,$3,\'Keep lead\',\'Keep notes\',$4,$4)', [leadId, pipelineId, stageId, createdAt]);
    await db.query('INSERT INTO leads (id,"pipelineId","stageId",name,"createdAt","updatedAt") VALUES ($1,$2,$3,\'No stage history\',$4,$4)', [legacyLeadId, pipelineId, stageId, createdAt]);
    await db.query('INSERT INTO lead_activities (id,"leadId",type,content,"createdAt") VALUES ($1,$2,\'STAGE_CHANGE\',\'Moved into stage\',$3)', [activityId, leadId, stageChangedAt]);

    const first = await migrate(db);
    assert.equal(first.alreadyApplied, false);
    const [lead] = (await db.query('SELECT id, notes, "stageEnteredAt" FROM leads WHERE id=$1', [leadId])).rows;
    assert.equal(lead.id, leadId);
    assert.equal(lead.notes, "Keep notes");
    assert.equal(lead.stageEnteredAt.toISOString(), stageChangedAt.toISOString());
    const [legacyLead] = (await db.query('SELECT "stageEnteredAt" FROM leads WHERE id=$1', [legacyLeadId])).rows;
    assert.equal(legacyLead.stageEnteredAt.toISOString(), createdAt.toISOString());
    assert.equal(await count(db, "pipelines"), 1);
    assert.equal(await count(db, "lead_activities"), 1);
    assert.equal(await count(db, "leads"), 2);
    assert.equal((await migrate(db)).alreadyApplied, true);
  } finally { await db.close(); }
});
