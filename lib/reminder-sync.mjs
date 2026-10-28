const clockExpression = "COALESCE($2::timestamp, timezone('UTC', CURRENT_TIMESTAMP))";

const syncSql = `
  INSERT INTO lead_reminders ("userId", "leadId", "stageEnteredAt", "lastRemindedAt", "dismissedAt")
  SELECT $1::uuid, lead.id, lead."stageEnteredAt", ${clockExpression}, NULL
  FROM leads AS lead
  WHERE lead."stageEnteredAt" < ${clockExpression} - interval '24 hours'
  ON CONFLICT ("userId", "leadId") DO UPDATE SET
    "stageEnteredAt" = EXCLUDED."stageEnteredAt",
    "lastRemindedAt" = ${clockExpression},
    "dismissedAt" = NULL
  WHERE lead_reminders."stageEnteredAt" IS DISTINCT FROM EXCLUDED."stageEnteredAt"
     OR lead_reminders."lastRemindedAt" <= ${clockExpression} - interval '6 hours'
  RETURNING "leadId"
`;

const selectSql = `
  SELECT reminder."leadId" AS "leadId", lead.name AS "leadName",
         reminder."stageEnteredAt" AS "stageEnteredAt",
         reminder."lastRemindedAt" AS "lastRemindedAt",
         stage.name AS "stageName", pipeline.name AS "pipelineName",
         pipeline.id AS "pipelineId", stage.id AS "stageId"
  FROM lead_reminders AS reminder
  JOIN leads AS lead ON lead.id = reminder."leadId"
  JOIN pipeline_stages AS stage ON stage.id = lead."stageId" AND stage."pipelineId" = lead."pipelineId"
  JOIN pipelines AS pipeline ON pipeline.id = lead."pipelineId"
  WHERE reminder."userId" = $1::uuid
    AND reminder."dismissedAt" IS NULL
    AND reminder."stageEnteredAt" = lead."stageEnteredAt"
    AND lead."stageEnteredAt" < ${clockExpression} - interval '24 hours'
  ORDER BY reminder."lastRemindedAt" ASC, lead.name ASC
`;

const dismissSql = `
  UPDATE lead_reminders AS reminder
  SET "dismissedAt" = COALESCE($5::timestamp, now()::timestamp)
  WHERE reminder."userId" = $1::uuid
    AND reminder."leadId" = $2::uuid
    AND reminder."stageEnteredAt" = $3::timestamp
    AND reminder."lastRemindedAt" = $4::timestamp
    AND reminder."dismissedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM leads AS lead
      WHERE lead.id = reminder."leadId"
        AND lead."stageEnteredAt" = reminder."stageEnteredAt"
        AND lead."stageEnteredAt" < COALESCE($5::timestamp, timezone('UTC', CURRENT_TIMESTAMP)) - interval '24 hours'
    )
  RETURNING reminder."leadId" AS "leadId"
`;

export async function syncLeadReminders({ query, userId, now = null }) {
  const clock = sqlTimestamp(now);
  await query(syncSql, [userId, clock]);
  return query(selectSql, [userId, clock]);
}

export async function dismissLeadReminder({ query, userId, leadId, stageEnteredAt, lastRemindedAt, now = null }) {
  return query(dismissSql, [userId, leadId, sqlTimestamp(stageEnteredAt), sqlTimestamp(lastRemindedAt), sqlTimestamp(now)]);
}

function sqlTimestamp(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError("Invalid reminder timestamp.");
  return date.toISOString().slice(0, -1).replace("T", " ");
}

export const reminderSql = { sync: syncSql, select: selectSql, dismiss: dismissSql };
