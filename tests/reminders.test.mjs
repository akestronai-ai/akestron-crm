import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { applyDatabaseMigration } from "../scripts/database-migration.mjs";
import { dismissLeadReminder, reminderSql, syncLeadReminders } from "../lib/reminder-sync.mjs";

process.env.TZ = "UTC";

async function migrate(db) {
  return db.transaction(tx => applyDatabaseMigration({
    execute: (sql, params = []) => tx.query(sql, params),
    query: async (sql, params = []) => (await tx.query(sql, params)).rows,
  }));
}

test("reminder sync uses strict 24h and exact 6h thresholds, persists per-user cycles, and cascades", async () => {
  const db = new PGlite();
  try {
    await db.exec("SET TIME ZONE 'UTC'");
    await migrate(db);
    const now = new Date("2026-03-10T12:00:00.000Z");
    const exactLead = randomUUID();
    const dueLead = randomUUID();
    const userOne = randomUUID();
    const userTwo = randomUUID();
    const [{ id: pipelineId }] = (await db.query("SELECT id FROM pipelines LIMIT 1")).rows;
    const [{ id: stageId }] = (await db.query('SELECT id FROM pipeline_stages WHERE "pipelineId"=$1 LIMIT 1', [pipelineId])).rows;
    for (const [id, name] of [[userOne, "First temporary user"], [userTwo, "Second temporary user"]]) {
      await db.query('INSERT INTO app_users (id,email,name,"passwordHash","updatedAt") VALUES ($1,$2,$3,\'not-used\',now())', [id, `${id}@example.test`, name]);
    }
    const exact = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const justOver = new Date(exact.getTime() - 1);
    for (const [id, name, stageEnteredAt] of [[exactLead, "Exactly 24 hours", exact], [dueLead, "Just over 24 hours", justOver]]) {
      await db.query('INSERT INTO leads (id,"pipelineId","stageId",name,"stageEnteredAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now())', [id, pipelineId, stageId, name, stageEnteredAt]);
    }

    const query = (sql, params = []) => db.query(sql, params).then(result => result.rows);
    let reminders = await syncLeadReminders({ query, userId: userOne, now });
    assert.deepEqual(reminders.map(reminder => reminder.leadId), [dueLead]);
    await db.query("DELETE FROM leads WHERE id=$1", [exactLead]);
    const dueReminder = reminders[0];
    assert.equal(dueReminder.leadName, "Just over 24 hours");

    reminders = await syncLeadReminders({ query, userId: userTwo, now });
    assert.equal(reminders.length, 1, "each account receives its own reminder");

    const beforeSixHours = new Date(now.getTime() + 6 * 60 * 60 * 1000 - 1);
    reminders = await syncLeadReminders({ query, userId: userOne, now: beforeSixHours });
    assert.equal(reminders[0].lastRemindedAt.toISOString(), now.toISOString());
    const atSixHours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    reminders = await syncLeadReminders({ query, userId: userOne, now: atSixHours });
    assert.equal(reminders[0].lastRemindedAt.toISOString(), atSixHours.toISOString());

    const dismissedAt = new Date(atSixHours.getTime() + 1000);
    const dismissed = await dismissLeadReminder({
      query, userId: userOne, leadId: dueLead, stageEnteredAt: justOver,
      lastRemindedAt: atSixHours, now: dismissedAt,
    });
    assert.equal(dismissed.length, 1);
    assert.equal((await syncLeadReminders({ query, userId: userOne, now: new Date(atSixHours.getTime() + 6 * 60 * 60 * 1000 - 1) })).length, 0);
    const nextCycleAt = new Date(atSixHours.getTime() + 6 * 60 * 60 * 1000);
    reminders = await syncLeadReminders({ query, userId: userOne, now: nextCycleAt });
    assert.equal(reminders.length, 1, "dismissal is reset when the next 6h cycle is due");
    assert.equal(reminders[0].lastRemindedAt.toISOString(), nextCycleAt.toISOString());

    const staleDismiss = await dismissLeadReminder({
      query, userId: userOne, leadId: dueLead, stageEnteredAt: justOver,
      lastRemindedAt: atSixHours, now: new Date(nextCycleAt.getTime() + 1),
    });
    assert.equal(staleDismiss.length, 0, "old dismiss token cannot hide a later cycle");
    assert.equal((await syncLeadReminders({ query, userId: userTwo, now: nextCycleAt })).length, 1, "other account remains independent");

    await db.query('UPDATE leads SET "stageEnteredAt"=$1 WHERE id=$2', [new Date(nextCycleAt.getTime()), dueLead]);
    assert.equal((await syncLeadReminders({ query, userId: userOne, now: new Date(nextCycleAt.getTime() + 24 * 60 * 60 * 1000) })).length, 0, "a newer stage episode clears the old reminder");
    await db.query("DELETE FROM leads WHERE id=$1", [dueLead]);
    assert.equal((await db.query('SELECT count(*) AS count FROM lead_reminders WHERE "leadId"=$1', [dueLead])).rows[0].count, 0, "lead delete cascades reminder rows");
  } finally { await db.close(); }
});

test("concurrent sync claims only one reminder interval advance", async () => {
  const db = new PGlite();
  try {
    await db.exec("SET TIME ZONE 'UTC'");
    await migrate(db);
    const userId = randomUUID(); const leadId = randomUUID(); const now = new Date("2026-05-01T00:00:00.000Z");
    const [{ id: pipelineId }] = (await db.query("SELECT id FROM pipelines LIMIT 1")).rows;
    const [{ id: stageId }] = (await db.query('SELECT id FROM pipeline_stages WHERE "pipelineId"=$1 LIMIT 1', [pipelineId])).rows;
    await db.query('INSERT INTO app_users (id,email,name,"passwordHash","updatedAt") VALUES ($1,$2,\'Temporary user\',\'unused\',now())', [userId, `${userId}@example.test`]);
    await db.query('INSERT INTO leads (id,"pipelineId","stageId",name,"stageEnteredAt","updatedAt") VALUES ($1,$2,$3,\'Concurrent lead\',$4,now())', [leadId, pipelineId, stageId, new Date(now.getTime() - 25 * 60 * 60 * 1000)]);

    const [first, second] = await Promise.all([
      db.query(reminderSql.sync, [userId, "2026-05-01 00:00:00.000"]),
      db.query(reminderSql.sync, [userId, "2026-05-01 00:00:00.000"]),
    ]);
    assert.equal(first.rows.length + second.rows.length, 1, "unique upsert interval condition permits only one claim");
    const reminders = await syncLeadReminders({ query: (sql, params = []) => db.query(sql, params).then(result => result.rows), userId, now });
    assert.equal(reminders.length, 1, "the reminder persists after a reload");
    assert.equal(reminders[0].lastRemindedAt.toISOString(), now.toISOString());
  } finally { await db.close(); }
});

test("default sync and dismissal clocks remain UTC in a non-UTC database session", async () => {
  const db = new PGlite();
  try {
    process.env.TZ = "UTC";
    await db.exec("SET TIME ZONE 'America/Los_Angeles'");
    await migrate(db);
    const userId = randomUUID(); const leadId = randomUUID();
    const [{ id: pipelineId }] = (await db.query("SELECT id FROM pipelines LIMIT 1")).rows;
    const [{ id: stageId }] = (await db.query('SELECT id FROM pipeline_stages WHERE "pipelineId"=$1 LIMIT 1', [pipelineId])).rows;
    await db.query('INSERT INTO app_users (id,email,name,"passwordHash","updatedAt") VALUES ($1,$2,\'Temporary user\',\'unused\',now())', [userId, `${userId}@example.test`]);
    await db.query(`INSERT INTO leads (id,"pipelineId","stageId",name,"stageEnteredAt","updatedAt")
      VALUES ($1,$2,$3,'UTC clock lead',timezone('UTC', CURRENT_TIMESTAMP) - interval '25 hours',CURRENT_TIMESTAMP)`, [leadId, pipelineId, stageId]);
    const query = (sql, params = []) => db.query(sql, params).then(result => result.rows);
    const [reminder] = await syncLeadReminders({ query, userId });
    assert.equal(reminder.leadId, leadId);
    const dismissed = await dismissLeadReminder({ query, userId, leadId, stageEnteredAt: reminder.stageEnteredAt, lastRemindedAt: reminder.lastRemindedAt });
    assert.equal(dismissed.length, 1);
    assert.equal((await syncLeadReminders({ query, userId })).length, 0);
  } finally { await db.close(); }
});
