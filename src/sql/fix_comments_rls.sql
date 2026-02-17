-- =========================================================
-- MASTER ANONYMOUS DELETION PANIC FIX (SECRET ROOM)
-- Targets: public.confessions, public.confession_comments, public.comments
-- Allows: Authors, Post Owners, and Executive Admins/Developers
-- =========================================================

-- 1. FIX FOR PUBLIC.CONFESSIONS (The main posts)
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators and Admins can delete confessions" ON public.confessions;
DROP POLICY IF EXISTS "Users can delete own confessions" ON public.confessions;

CREATE POLICY "Creators and Admins can delete confessions"
ON public.confessions FOR DELETE
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'developer' OR profiles.username IN ('arun', 'koki'))
  )
  OR auth.jwt() ->> 'email' IN (
    'carunbtech23@ced.alliance.edu.in',
    'gkartikaybtech23@ced.alliance.edu.in',
    'aateefbtech23@ced.alliance.edu.in',
    'sshlokbtech23@ced.alliance.edu.in',
    'aateef@ced.alliance.edu.in',
    'sshlok@ced.alliance.edu.in'
  )
);

-- 2. FIX FOR PUBLIC.CONFESSION_COMMENTS (Comments on anonymous signals)
ALTER TABLE public.confession_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own confession comments" ON public.confession_comments;
DROP POLICY IF EXISTS "Admins can delete confession comments" ON public.confession_comments;

CREATE POLICY "Users can delete their own confession comments" 
ON public.confession_comments FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete confession comments" 
ON public.confession_comments FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'developer' OR profiles.username IN ('arun', 'koki'))
  )
  OR auth.jwt() ->> 'email' IN (
    'carunbtech23@ced.alliance.edu.in',
    'gkartikaybtech23@ced.alliance.edu.in',
    'aateefbtech23@ced.alliance.edu.in',
    'sshlokbtech23@ced.alliance.edu.in',
    'aateef@ced.alliance.edu.in',
    'sshlok@ced.alliance.edu.in'
  )
);


-- 3. FIX FOR PUBLIC.COMMENTS (Regular feed comments)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
DROP POLICY IF EXISTS "Post owners can delete comments on their posts" ON public.comments;

CREATE POLICY "Users can delete their own comments" 
ON public.comments FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment" 
ON public.comments FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'developer' OR profiles.username IN ('arun', 'koki'))
  )
  OR auth.jwt() ->> 'email' IN (
    'carunbtech23@ced.alliance.edu.in',
    'gkartikaybtech23@ced.alliance.edu.in',
    'aateefbtech23@ced.alliance.edu.in',
    'sshlokbtech23@ced.alliance.edu.in',
    'aateef@ced.alliance.edu.in',
    'sshlok@ced.alliance.edu.in'
  )
);

CREATE POLICY "Post owners can delete comments on their posts" 
ON public.comments FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.posts 
    WHERE posts.id = public.comments.post_id 
    AND posts.user_id = auth.uid()
  )
);

-- Force schema reload
NOTIFY pgrst, 'reload schema';
