import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import "../scripts/load-env.mjs";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password.mjs";
import { databaseUrl } from "../lib/database-url.mjs";
import { resetAccountPassword } from "../lib/account-admin.mjs";

// Explicit opt-in: this suite writes temporary records to the running app's
// configured PostgreSQL database and removes its pipelines in finally.
const base = process.env.TEST_BASE_URL;
test("authenticated shared CRM, sessions, and duplicate leads", { skip: !base }, async () => {
  const root = new URL(base).origin;
  const createdPipelines = [];
  const db = new PrismaClient({ datasourceUrl: databaseUrl() });
  const testPassword = `temporary-${randomUUID()}-secret`;
  const suffix = randomUUID();
  const testUsers = await Promise.all([
    db.appUser.create({ data: { email: `api-one-${suffix}@example.test`, name: `API tester one ${suffix}`, passwordHash: await hashPassword(testPassword) } }),
    db.appUser.create({ data: { email: `api-two-${suffix}@example.test`, name: `API tester two ${suffix}`, passwordHash: await hashPassword(testPassword) } }),
  ]);
  let cookie = "";
  async function request(path, method = "GET", input, expected = 200) {
    const response = await fetch(root + path, { method, redirect: "manual", headers: { Origin: root, ...(cookie ? { Cookie: cookie } : {}), ...(input !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) });
    const data = await response.json().catch(() => null);
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    if (expected === 200) assert.equal(data.success, true);
    return data;
  }
  try {
    for (const path of ["/", "/crm", "/warmup"]) assert.ok([200, 307].includes((await fetch(root + path, { redirect: "manual" })).status));
    assert.equal((await fetch(root + "/login", { redirect: "manual" })).status, 200);
    for (const path of ["/signup", "/team", "/setup", "/api/workspace", "/auth/confirm"]) assert.equal((await fetch(root + path, { redirect: "manual" })).status, 404);
    const protectedEndpoints = [
      ["GET", "/api/pipelines"], ["GET", "/api/leads"], ["GET", "/api/settings"],
      ["POST", "/api/pipelines"], ["POST", "/api/leads"], ["POST", "/api/settings"], ["POST", "/api/stages"],
      ["POST", "/api/reminders/sync"], ["POST", `/api/reminders/${randomUUID()}/dismiss`],
      ["GET", `/api/pipelines/${randomUUID()}`], ["PUT", `/api/pipelines/${randomUUID()}`], ["DELETE", `/api/pipelines/${randomUUID()}`],
      ["PUT", `/api/stages/${randomUUID()}`], ["DELETE", `/api/stages/${randomUUID()}`],
      ["GET", `/api/leads/${randomUUID()}`], ["PUT", `/api/leads/${randomUUID()}`], ["DELETE", `/api/leads/${randomUUID()}`],
      ["POST", `/api/leads/${randomUUID()}/activity`],
    ];
    for (const [method, path] of protectedEndpoints) await request(path, method, undefined, 401);
    const badLogin = await fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: "nobody@example.test", password: testPassword }) });
    assert.equal(badLogin.status, 401);
    const globalAttemptsBefore = Number((await db.$queryRaw`SELECT count FROM auth_attempts WHERE email = '__global__'`)[0]?.count || 0);
    const sentinelLogin = await fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: "__global__", password: testPassword }) });
    assert.equal(sentinelLogin.status, 401);
    assert.equal(Number((await db.$queryRaw`SELECT count FROM auth_attempts WHERE email = '__global__'`)[0].count), globalAttemptsBefore + 1);
    const login = await fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: testUsers[0].email, password: testPassword }) });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie") || "", /^crm_session=.*HttpOnly/);
    cookie = login.headers.get("set-cookie").split(";")[0];
    const missingOrigin = await fetch(root + "/api/settings", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ startDate: "2026-01-01" }) });
    assert.equal(missingOrigin.status, 403);
    const forged = await fetch(root + "/api/pipelines", { headers: { Cookie: "crm_session=forged-token" } });
    assert.equal(forged.status, 401);
    const expiredToken = `expired-${randomUUID()}`;
    await db.appSession.create({ data: { userId: testUsers[0].id, tokenHash: createHash("sha256").update(expiredToken).digest("hex"), expiresAt: new Date(Date.now() - 1000) } });
    const expired = await fetch(root + "/api/pipelines", { headers: { Cookie: `crm_session=${expiredToken}` } });
    assert.equal(expired.status, 401);
    await request("/api/pipelines", "POST", null, 400);
    await request("/api/pipelines", "POST", { name: "Invalid stages", stages: [null] }, 400);
    const pipeline = (await request("/api/pipelines", "POST", { name: `API verification ${randomUUID()}`, stages: [{ name: "Sourced" }, { name: "Contacted" }] })).pipeline;
    createdPipelines.push(pipeline.id);
    assert.equal(pipeline.stages.length, 2);
    const other = (await request("/api/pipelines", "POST", { name: `API verification ${randomUUID()}` })).pipeline;
    createdPipelines.push(other.id);
    assert.equal(other.stages.length, 8);
    await request(`/api/pipelines/${pipeline.id}`, "PUT", { description: "Updated through Prisma" });
    const extraStage = (await request("/api/stages", "POST", { pipelineId: pipeline.id, name: "Extra" })).stage;
    await request(`/api/stages/${extraStage.id}`, "PUT", { name: "Renamed", order: 4 });
    const input = { name: "Temporary verification lead", pipelineId: pipeline.id, stageId: pipeline.stages[0].id, email: "verification@example.test", notes: "Initial note", channel: "FACEBOOK" };
    await request("/api/leads", "POST", { ...input, stageId: other.stages[0].id }, 400);
    const lead = (await request("/api/leads", "POST", input)).lead;
    assert.equal(lead.activities.length, 1);
    await request(`/api/leads/${lead.id}`, "PUT", { stageId: pipeline.stages[1].id, notes: "Updated note" });
    await request(`/api/leads/${lead.id}`, "PUT", { stageId: other.stages[0].id }, 400);
    await request(`/api/leads/${lead.id}`, "PUT", { followUpCount: -1 }, 400);
    await request(`/api/leads/${lead.id}/activity`, "POST", { content: "Verification activity", type: "NOTE" });
    for (let i = 0; i < 3; i++) await request(`/api/leads/${lead.id}`, "PUT", { incrementFollowUp: true });
    const updated = (await request(`/api/leads/${lead.id}`)).lead;
    assert.equal(updated.notes, "Updated note");
    assert.equal(updated.stageId, pipeline.stages[1].id);
    assert.equal(updated.followUpCount, 3);
    assert.equal(updated.activities.length, 6);
    assert.equal(updated.activities.filter(a => a.type === "FOLLOW_UP").length, 3);
    const oldStageEntry = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db.lead.update({ where: { id: lead.id }, data: { stageEnteredAt: oldStageEntry } });
    let reminderResponse = await request("/api/reminders/sync", "POST", {});
    assert.ok(reminderResponse.reminders.some(reminder => reminder.leadId === lead.id));
    await request(`/api/leads/${lead.id}`, "PUT", { stageId: updated.stageId, notes: "Same-stage edit" });
    await request(`/api/leads/${lead.id}`, "PUT", { incrementFollowUp: true });
    const afterSameStageEdits = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    assert.equal(afterSameStageEdits.stageEnteredAt.toISOString(), oldStageEntry.toISOString());
    const leadReminder = reminderResponse.reminders.find(reminder => reminder.leadId === lead.id);
    await request(`/api/reminders/${lead.id}/dismiss`, "POST", { episode: leadReminder.stageEnteredAt, lastRemindedAt: leadReminder.lastRemindedAt });
    reminderResponse = await request("/api/reminders/sync", "POST", {});
    assert.ok(!reminderResponse.reminders.some(reminder => reminder.leadId === lead.id));
    await request(`/api/leads/${lead.id}`, "PUT", { stageId: pipeline.stages[0].id });
    const afterMove = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    assert.ok(afterMove.stageEnteredAt > oldStageEntry);
    reminderResponse = await request("/api/reminders/sync", "POST", {});
    assert.ok(!reminderResponse.reminders.some(reminder => reminder.leadId === lead.id));
    const otherIdentity = (await request("/api/leads", "POST", { ...input, name: "Other identity", email: "other@example.test", pipelineId: other.id, stageId: other.stages[0].id })).lead;
    await request(`/api/leads/${otherIdentity.id}`, "PUT", { email: "verification@example.test" }, 409);
    await request(`/api/leads/${lead.id}`, "PUT", { email: null, profileUrl: null }, 400);
    const profileLead = (await request("/api/leads", "POST", { ...input, name: "Profile identity", email: "", profileUrl: "https://instagram.com/UniqueUser/?utm_source=one" })).lead;
    assert.equal(profileLead.profileKey, "https://instagram.com/uniqueuser");
    await request("/api/leads", "POST", { ...input, name: "Profile duplicate", email: "", profileUrl: "http://www.instagram.com/uniqueuser?igsh=share" }, 409);
    const concurrent = await Promise.all([
      fetch(root + "/api/leads", { method: "POST", headers: { Origin: root, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ ...input, name: "Concurrent first", email: "Same@Example.test" }) }),
      fetch(root + "/api/leads", { method: "POST", headers: { Origin: root, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ ...input, name: "Concurrent second", email: " same@example.test " }) }),
    ]);
    const concurrentBodies = await Promise.all(concurrent.map(r => r.json()));
    assert.equal(concurrent.filter(r => r.status === 200).length, 1);
    assert.equal(concurrent.filter(r => r.status === 409).length, 1);
    assert.equal(concurrentBodies.find(b => b.code === "DUPLICATE_LEAD")?.duplicate.name.startsWith("Concurrent"), true);
    const secondLogin = await fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: testUsers[1].email, password: testPassword }) });
    const secondCookie = secondLogin.headers.get("set-cookie").split(";")[0];
    const crossAccount = await fetch(root + "/api/leads", { method: "POST", headers: { Origin: root, Cookie: secondCookie, "Content-Type": "application/json" }, body: JSON.stringify({ ...input, name: "Partner duplicate", email: " VERIFICATION@example.test " }) });
    assert.equal(crossAccount.status, 409);
    assert.equal((await crossAccount.json()).code, "DUPLICATE_LEAD");
    const settings = await request("/api/settings");
    await request("/api/settings", "POST", { startDate: "2026-02-30" }, 400);
    await request("/api/settings", "POST", { startDate: settings.startDate });
    const foreign = await fetch(root + `/api/leads/${lead.id}`, { method: "DELETE", headers: { Origin: "https://example.invalid", Cookie: cookie } });
    assert.equal(foreign.status, 403);
    await request(`/api/leads/${lead.id}`, "DELETE");
    await request(`/api/leads/${lead.id}`, "GET", undefined, 404);
    const cascade = (await request("/api/leads", "POST", { ...input, stageId: extraStage.id })).lead;
    await request(`/api/stages/${extraStage.id}`, "DELETE");
    await request(`/api/leads/${cascade.id}`, "GET", undefined, 404);
    await request(`/api/leads/not-an-id`, "GET", undefined, 400);
    await request(`/api/pipelines/${randomUUID()}`, "GET", undefined, 404);
    const all = await request("/api/pipelines");
    assert.ok(all.pipelines.some(p => p.id === pipeline.id));
    const badAttempts = await Promise.all(Array.from({ length: 11 }, () => fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: testUsers[1].email, password: `wrong-${randomUUID()}-password` }) })));
    assert.ok(badAttempts.some(response => response.status === 429));
    assert.equal(badAttempts.find(response => response.status === 429).headers.get("retry-after"), "900");
    const replacementPassword = `reset-${randomUUID()}-secret`;
    await resetAccountPassword(db, testUsers[0].email, await hashPassword(replacementPassword));
    const oldSession = await fetch(root + "/api/pipelines", { headers: { Cookie: cookie } });
    assert.equal(oldSession.status, 401);
    const replacementLogin = await fetch(root + "/api/auth/login", { method: "POST", headers: { Origin: root, "Content-Type": "application/json" }, body: JSON.stringify({ email: testUsers[0].email, password: replacementPassword }) });
    assert.equal(replacementLogin.status, 200);
    cookie = replacementLogin.headers.get("set-cookie").split(";")[0];
  } finally {
    await db.pipeline.deleteMany({ where: { id: { in: createdPipelines } } });
    if (cookie) {
      const logout = await fetch(root + "/api/auth/logout", { method: "POST", headers: { Origin: root, Cookie: cookie } });
      assert.equal(logout.status, 200);
      assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/);
      const revoked = await fetch(root + "/api/pipelines", { headers: { Cookie: cookie } });
      assert.equal(revoked.status, 401);
    }
    await db.appUser.deleteMany({ where: { id: { in: testUsers.map(user => user.id) } } });
    await db.$disconnect();
  }
});
