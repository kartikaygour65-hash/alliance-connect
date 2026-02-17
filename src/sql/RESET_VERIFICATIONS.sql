-- =========================================================
-- RESET VERIFICATIONS & CLEANUP
-- =========================================================

-- 1. Reset all 'pending' requests to 'none' (or delete them if you prefer)
-- This clears the "Request Pending" state from the UI everywhere.
UPDATE "public"."profiles"
SET verification_status = 'none', verified_title = NULL
WHERE verification_status = 'pending';

-- 2. (Optional) If you want to unverify everyone and start fresh:
-- UPDATE "public"."profiles"
-- SET is_verified = false, verification_status = 'none', verified_title = NULL;

-- 3. Ensure Notifications for verification are cleaned up if needed
-- DELETE FROM "public"."notifications" WHERE type = 'system' AND data->>'type' = 'verification_request';

NOTIFY pgrst, 'reload schema';
