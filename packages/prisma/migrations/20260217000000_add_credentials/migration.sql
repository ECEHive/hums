-- Create Credential table for multi-credential user authentication
CREATE TABLE "Credential" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- Create unique index on credential value (each credential globally unique)
CREATE UNIQUE INDEX "Credential_value_key" ON "Credential"("value");

-- Create index on userId for efficient lookups
CREATE INDEX "Credential_userId_idx" ON "Credential"("userId");

-- Add foreign key constraint
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing cardNumber data into Credential table
INSERT INTO "Credential" ("value", "userId")
    SELECT "cardNumber", "id"
    FROM "User"
    WHERE "cardNumber" IS NOT NULL
    ON CONFLICT ("value") DO NOTHING;

-- Remove legacy cardNumber column from User table (data already migrated to Credential)
ALTER TABLE "User" DROP COLUMN "cardNumber";
