-- Ensure follow requests are required for private accounts, and accepting a request can create the follow relationship

-- 1) Replace overly-permissive/insufficient INSERT rules on follows
DROP POLICY IF EXISTS "Authenticated users can follow" ON public.follows;

-- Following a public account: follower creates the relationship
CREATE POLICY "Users can follow public accounts"
ON public.follows
FOR INSERT
WITH CHECK (
  auth.uid() = follower_id
  AND COALESCE((SELECT is_private FROM public.profiles WHERE user_id = following_id), false) = false
);

-- Accepting a follow request: the private account owner (following_id) can create the relationship
CREATE POLICY "Users can accept follow requests"
ON public.follows
FOR INSERT
WITH CHECK (
  auth.uid() = following_id
  AND EXISTS (
    SELECT 1
    FROM public.follow_requests fr
    WHERE fr.requester_id = follower_id
      AND fr.target_id = following_id
      AND fr.status = 'accepted'
  )
);
