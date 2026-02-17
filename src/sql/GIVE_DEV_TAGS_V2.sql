-- =========================================================
-- UPDATE DEVELOPER TAGS (V2)
-- Only exactly 4 specified emails get the 'developer' tag.
-- Others are reset if they were developers.
-- =========================================================

-- 1. Reset any existing 'developer' roles to 'user' (excluding the targets if they already have it)
-- This ensures ONLY the specified 4 have the dev tag.
UPDATE "public"."profiles"
SET "role" = 'user'
WHERE "role" = 'developer';

-- 2. Set 'developer' role for the 4 specific emails
-- We join with auth.users to find the user_id by email.
UPDATE "public"."profiles"
SET "role" = 'developer',
    "is_verified" = true,
    "verification_status" = 'verified'
WHERE "user_id" IN (
    SELECT "id" FROM auth.users 
    WHERE "email" IN (
        'gkartikaybtech23@ced.alliance.edu.in',
        'aateefbtech23@ced.alliance.edu.in',
        'sshlokbtech23@ced.alliance.edu.in',
        'carunbtech23@ced.alliance.edu.in'
    )
);

-- 3. Ensure verification columns are consistent for others
-- Only users with verification_status = 'verified' or is_verified = true show as verified.
-- The UserBadge component handles the UI logic.

NOTIFY pgrst, 'reload schema';
