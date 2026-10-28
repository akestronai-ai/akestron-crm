-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "warmup_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "startDate" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warmup_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "niche" TEXT,
    "location" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'GOLD',
    "channel" TEXT NOT NULL DEFAULT 'FACEBOOK',
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "profileUrl" TEXT,
    "techStack" TEXT,
    "dealValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "lastContactDate" TEXT,
    "nextFollowUpDate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_stages_pipelineId_idx" ON "pipeline_stages"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_id_pipelineId_key" ON "pipeline_stages"("id", "pipelineId");

-- CreateIndex
CREATE INDEX "leads_stageId_pipelineId_idx" ON "leads"("stageId", "pipelineId");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_idx" ON "lead_activities"("leadId");

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_stageId_pipelineId_fkey" FOREIGN KEY ("stageId", "pipelineId") REFERENCES "pipeline_stages"("id", "pipelineId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Domain constraints also protect data written by database tools.
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_name_check" CHECK (length(trim(name)) > 0);
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_name_check" CHECK (length(trim(name)) > 0);
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_order_check" CHECK ("order" >= 0);
ALTER TABLE "leads" ADD CONSTRAINT "leads_name_check" CHECK (length(trim(name)) > 0);
ALTER TABLE "leads" ADD CONSTRAINT "leads_tier_check" CHECK (tier IN ('PLATINUM', 'GOLD', 'BRONZE'));
ALTER TABLE "leads" ADD CONSTRAINT "leads_dealValue_check" CHECK ("dealValue" >= 0 AND "dealValue" <> 'NaN'::float8);
ALTER TABLE "leads" ADD CONSTRAINT "leads_followUpCount_check" CHECK ("followUpCount" >= 0);
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_content_check" CHECK (length(trim(content)) > 0);
REVOKE ALL ON "pipelines", "pipeline_stages", "leads", "lead_activities", "warmup_settings" FROM PUBLIC;
