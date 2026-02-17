-- ==========================================
-- AURA LEADERBOARD: LIVE VIEW
-- ==========================================
-- This view must be a LIVE aggregation so that when a post is deleted,
-- the aura counts immediately drop because the underlying `auras` rows are deleted (via CASCADE).

DROP VIEW IF EXISTS public.aura_leaderboard;

CREATE VIEW public.aura_leaderboard AS
SELECT 
  p.user_id,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  pr.department,
  COALESCE(SUM(p.aura_count), 0) as total_aura,
  -- Calculate growth (e.g., likes in last 7 days) for trending 
  COALESCE(SUM(CASE WHEN p.created_at > (now() - interval '7 days') THEN p.aura_count ELSE 0 END), 0) as aura_growth,
  RANK() OVER (ORDER BY COALESCE(SUM(p.aura_count), 0) DESC) as campus_rank
FROM public.posts p
JOIN public.profiles pr ON p.user_id = pr.user_id
GROUP BY p.user_id, pr.username, pr.full_name, pr.avatar_url, pr.department;

-- Ensure RLS is not blocking the view (views run with owner privileges usually, but let's be safe)
-- Grant access to authenticated users
GRANT SELECT ON public.aura_leaderboard TO authenticated;
GRANT SELECT ON public.aura_leaderboard TO anon;
