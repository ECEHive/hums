-- Migration: Hash credential values with HMAC-SHA256
-- Replaces plaintext credential storage with HMAC hashes for security.
-- Keeps a preview of the last 4 characters of the original value.
--
-- For existing databases with credential data, the HMAC secret must be
-- set as a PostgreSQL database-level setting before running this migration:
--   ALTER DATABASE <dbname> SET "credential.hmac_secret" = '<your-secret>';
-- The migrate-deploy.ts script handles this automatically when
-- CREDENTIAL_HMAC_SECRET is set in the environment.

-- Enable pgcrypto for HMAC hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: Add new columns (nullable initially for data migration)
ALTER TABLE "Credential" ADD COLUMN "hash" TEXT;
ALTER TABLE "Credential" ADD COLUMN "preview" TEXT;

-- Step 2: Populate new columns from existing plaintext values
DO $$
DECLARE
  _secret TEXT;
  _count INT;
BEGIN
  SELECT count(*) INTO _count FROM "Credential" WHERE "value" IS NOT NULL;

  IF _count = 0 THEN
    -- No existing data to migrate
    RETURN;
  END IF;

  -- Read the HMAC secret from the database-level setting
  _secret := current_setting('credential.hmac_secret', true);

  IF _secret IS NULL OR _secret = '' THEN
    RAISE EXCEPTION 'credential.hmac_secret is not set. Existing credentials cannot be migrated without the HMAC secret. Set CREDENTIAL_HMAC_SECRET in your environment and use the migrate-deploy script, or run: ALTER DATABASE <dbname> SET "credential.hmac_secret" = ''<secret>''; before running this migration.';
  END IF;

  UPDATE "Credential" SET
    "preview" = RIGHT("value", 4),
    "hash" = encode(hmac("value"::bytea, _secret::bytea, 'sha256'), 'hex');
END $$;

-- Step 3: Enforce NOT NULL constraints
ALTER TABLE "Credential" ALTER COLUMN "hash" SET NOT NULL;
ALTER TABLE "Credential" ALTER COLUMN "preview" SET NOT NULL;

-- Step 4: Remove plaintext value column and its unique index
DROP INDEX "Credential_value_key";
ALTER TABLE "Credential" DROP COLUMN "value";

-- Step 5: Add unique index on hash
CREATE UNIQUE INDEX "Credential_hash_key" ON "Credential"("hash");
