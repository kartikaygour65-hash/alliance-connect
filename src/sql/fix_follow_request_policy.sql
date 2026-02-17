-- FIX: Allow target users to accept follow requests
-- ===============================================

-- We previously enabled Update for 'requester_id' (to fix upsert), but we missed 'target_id' (to accept requests).
-- This policy allows BOTH the requester (to retry/cancel) and the target (to accept/reject) to update the row.

DROP POLICY IF EXISTS "Update own requests" ON "public"."follow_requests";
DROP POLICY IF EXISTS "Manage incoming requests" ON "public"."follow_requests";

CREATE POLICY "Manage follow requests" 
ON "public"."follow_requests" FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = requester_id  -- Allow requester to update (e.g. for upsert resolution or cancelling)
  OR 
  auth.uid() = target_id    -- Allow target to update (e.g. accepting/rejecting)
);

-- Force refresh
NOTIFY pgrst, 'reload schema';
