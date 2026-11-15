-- Multi-dealer marketplace (part 1/2): enum changes.
-- Kept separate because a new enum value cannot be used in the same transaction that adds it.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DEALER';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerStatus') THEN
    CREATE TYPE "DealerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
  END IF;
END $$;
