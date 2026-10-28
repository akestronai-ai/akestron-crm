import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "../scripts/load-env.mjs";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "../lib/database-url.mjs";
import { hashPassword } from "../lib/password.mjs";

const base = process.env.TEST_BASE_URL;

test("stage reminders persist per account, repeat after six hours, dismiss by cycle, and reset only on stage moves", { skip: !base }, async () => {
  const root = new URL(base).origin;
  const db = new PrismaClient({ datasourceUrl: databaseUrl() });
  const password = `reminder-${randomUUID()}-secret`;
  const suffix = randomUUID();
  const users = [];
  const pipelineIds = [];
  let cookieOne = "";
  let cookieTwo = "";

  async function api(path, cookie, method = "GET", input, status = 200) {
    const response = await fetch(root + path, {
      method,
      headers: { Origin: root, ...(cookie ? { Cookie: cookie } : {}), ...(input !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(input !== undefined ? { body: JSON.stringify(input) } : {}),
    });
    const data = await response.json().catch(() => null);
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
    if (status === 200) assert.equal(data.success, true);
    return data;
  }

  try {
    users.push(await db.appUser.create({ data: { email: `reminder-one-${suffix}@example.test`, name: `Reminder test one ${suffix}`, passwordHash: await hashPassword(password) } }));
    users.push(await db.appUser.create({ data: { email: `reminder-two-${suffix}@example.test`, name: `Reminder test two ${suffix}`, passwordHash: await hashPassword(password) } }));
    const pipeline = await db.pipeline.create({ data: {
      name: `Reminder verification ${suffix}`,
      stages: { create: [{ name: "First reminder stage", order: 1 }, { name: "Second reminder stage", order: 2 }] },
    }, include: { stages: true } });
    pipelineIds.push(pipeline.id);

    const loginOne = await fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: users[0].email, password }) });
    assert.equal(loginOne.status, 200);
    cookieOne = loginOne.headers.get("set-cookie").split(";")[0];
    const loginTwo = await fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: users[1].email, password }) });
    assert.equal(loginTwo.status, 200);
    cookieTwo = loginTwo.headers.get("set-cookie").split(";")[0];

    const created = await api("/api/leads", cookieOne, "POST", {
      name: `Reminder lead ${suffix}`, email: `lead-${suffix}@example.test`,
      pipelineId: pipeline.id, stageId: pipeline.stages[0].id,
    });
    const leadId = created.lead.id;
    const oldStageEnteredAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db.lead.update({ where: { id: leadId }, data: { stageEnteredAt: oldStageEnteredAt } });

    let one = await api("/api/reminders/sync", cookieOne, "POST", {});
    let two = await api("/api/reminders/sync", cookieTwo, "POST", {});
    const reminderOne = one.reminders.find(reminder => reminder.leadId === leadId);
    const reminderTwo = two.reminders.find(reminder => reminder.leadId === leadId);
    assert.ok(reminderOne && reminderTwo, "each account receives its own reminder");
    one = await api("/api/reminders/sync", cookieOne, "POST", {});
    assert.equal(one.reminders.find(reminder => reminder.leadId === leadId).lastRemindedAt, reminderOne.lastRemindedAt, "reloading does not advance or duplicate the current cycle");

    await api(`/api/leads/${leadId}`, cookieOne, "PUT", { notes: "Reminder test edit", stageId: pipeline.stages[0].id });
    await api(`/api/leads/${leadId}`, cookieOne, "PUT", { incrementFollowUp: true });
    let lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    assert.equal(lead.stageEnteredAt.toISOString(), oldStageEnteredAt.toISOString(), "notes, follow-up, and same-stage writes preserve the stage timer");

    await api(`/api/reminders/${leadId}/dismiss`, cookieOne, "POST", { episode: reminderOne.stageEnteredAt, lastRemindedAt: reminderOne.lastRemindedAt });
    one = await api("/api/reminders/sync", cookieOne, "POST", {});
    assert.ok(!one.reminders.some(reminder => reminder.leadId === leadId), "dismissal hides only this account's current cycle");
    two = await api("/api/reminders/sync", cookieTwo, "POST", {});
    assert.ok(two.reminders.some(reminder => reminder.leadId === leadId), "dismissing in one account does not suppress the partner");

    const pastSixHours = new Date(Date.now() - 6 * 60 * 60 * 1000 - 1000);
    await db.leadReminder.update({ where: { userId_leadId: { userId: users[0].id, leadId } }, data: { lastRemindedAt: pastSixHours, dismissedAt: new Date(Date.now() - 1000) } });
    one = await api("/api/reminders/sync", cookieOne, "POST", {});
    const nextCycle = one.reminders.find(reminder => reminder.leadId === leadId);
    assert.ok(nextCycle, "the reminder returns after the six-hour interval");
    assert.ok(new Date(nextCycle.lastRemindedAt) > new Date(reminderOne.lastRemindedAt));
    const staleDismiss = await api(`/api/reminders/${leadId}/dismiss`, cookieOne, "POST", { episode: reminderOne.stageEnteredAt, lastRemindedAt: reminderOne.lastRemindedAt });
    assert.equal(staleDismiss.dismissed, false, "a stale dismiss token cannot hide the next cycle");

    await api(`/api/leads/${leadId}`, cookieOne, "PUT", { stageId: pipeline.stages[1].id });
    lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    assert.ok(lead.stageEnteredAt > oldStageEnteredAt, "a real move starts a new stage timer");
    one = await api("/api/reminders/sync", cookieOne, "POST", {});
    two = await api("/api/reminders/sync", cookieTwo, "POST", {});
    assert.ok(!one.reminders.some(reminder => reminder.leadId === leadId));
    assert.ok(!two.reminders.some(reminder => reminder.leadId === leadId));
  } finally {
    if (pipelineIds.length) await db.pipeline.deleteMany({ where: { id: { in: pipelineIds } } });
    if (users.length) await db.appUser.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await db.$disconnect();
  }
});
