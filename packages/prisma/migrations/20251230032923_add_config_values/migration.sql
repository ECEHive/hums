-- CreateTable
CREATE TABLE "ConfigValue" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigValue_key_key" ON "ConfigValue"("key");

-- CreateIndex
CREATE INDEX "ConfigValue_key_idx" ON "ConfigValue"("key");

-- Add configuration permissions
INSERT INTO "Permission" (name) VALUES
  ('config.read'),
  ('config.write')
ON CONFLICT (name) DO NOTHING;
