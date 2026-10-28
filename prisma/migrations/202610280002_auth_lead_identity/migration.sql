CREATE TABLE app_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  "passwordHash" text NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE app_sessions (
  id uuid PRIMARY KEY,
  "tokenHash" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX app_sessions_user_id_idx ON app_sessions("userId");
CREATE INDEX app_sessions_expires_at_idx ON app_sessions("expiresAt");
CREATE TABLE auth_attempts (
  email text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE leads ADD COLUMN "emailKey" text;
ALTER TABLE leads ADD COLUMN "profileKey" text;
ALTER TABLE leads ADD COLUMN "createdById" uuid;
ALTER TABLE leads ADD CONSTRAINT leads_created_by_id_fkey FOREIGN KEY ("createdById") REFERENCES app_users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX leads_email_key_key ON leads("emailKey");
CREATE UNIQUE INDEX leads_profile_key_key ON leads("profileKey");
REVOKE ALL ON app_users, app_sessions, auth_attempts FROM PUBLIC;
