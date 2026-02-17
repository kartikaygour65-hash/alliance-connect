-- Update stories RLS policy to respect private accounts
DROP POLICY IF EXISTS "Stories viewable when not expired" ON public.stories;

CREATE POLICY "Stories viewable for public accounts or followers"
ON public.stories FOR SELECT
USING (
  expires_at > now() AND (
    -- Own stories
    auth.uid() = user_id
    OR
    -- Stories from public accounts
    (SELECT is_private FROM public.profiles WHERE user_id = stories.user_id) = false
    OR
    -- Stories from private accounts user follows
    EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid()
      AND following_id = stories.user_id
    )
  )
);

-- Also update the story_highlights to respect privacy
DROP POLICY IF EXISTS "Anyone can view highlights" ON public.story_highlights;

CREATE POLICY "Highlights viewable for public accounts or followers"
ON public.story_highlights FOR SELECT
USING (
  -- Own highlights
  auth.uid() = user_id
  OR
  -- Highlights from public accounts
  (SELECT is_private FROM public.profiles WHERE user_id = story_highlights.user_id) = false
  OR
  -- Highlights from private accounts user follows
  EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid()
    AND following_id = story_highlights.user_id
  )
);