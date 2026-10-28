ALTER TABLE leads ADD COLUMN "stageEnteredAt" TIMESTAMP(3);
UPDATE leads AS lead
SET "stageEnteredAt" = GREATEST(
  lead."createdAt",
  COALESCE((SELECT MAX(activity."createdAt") FROM lead_activities AS activity WHERE activity."leadId" = lead.id AND activity.type = 'STAGE_CHANGE'), lead."createdAt")
);
ALTER TABLE leads ALTER COLUMN "stageEnteredAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE leads ALTER COLUMN "stageEnteredAt" SET NOT NULL;
CREATE INDEX leads_stage_entered_at_idx ON leads("stageEnteredAt");

CREATE TABLE lead_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "leadId" uuid NOT NULL,
  "stageEnteredAt" TIMESTAMP(3) NOT NULL,
  "lastRemindedAt" TIMESTAMP(3) NOT NULL,
  "dismissedAt" TIMESTAMP(3),
  CONSTRAINT lead_reminders_user_id_fkey FOREIGN KEY ("userId") REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT lead_reminders_lead_id_fkey FOREIGN KEY ("leadId") REFERENCES leads(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT lead_reminders_user_id_lead_id_key UNIQUE ("userId", "leadId")
);
CREATE INDEX lead_reminders_user_id_dismissed_at_idx ON lead_reminders("userId", "dismissedAt");
REVOKE ALL ON lead_reminders FROM PUBLIC;
