-- =========================================================
-- DEV TAGS & ROLE UPDATES
-- Sets specified users as developers in the database.
-- =========================================================

-- 1. Update roles to 'developer' for the specified users
UPDATE "public"."profiles"
SET "role" = 'developer'
WHERE "username" IN ('shlok', 'ateef_12', 'ateef', 'areef', 'koki', 'kartikaygour');

-- 2. Ensure verification columns are consistent
UPDATE "public"."profiles"
SET "verification_status" = 'verified'
WHERE "is_verified" = true;

UPDATE "public"."profiles"
SET "verification_status" = 'none'
WHERE "is_verified" = false OR "is_verified" IS NULL;

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
