-- Add is_pinned column to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Add RLS policy for pinning
-- Only allow specific administrative users or developers to toggle it.
-- Or just check role='admin' but the request was specifically for a certain email.
-- Let's use the role-based + email fallback pattern we've used before.

DROP POLICY IF EXISTS "Allow admins to toggle pinned status" ON public.posts;
CREATE POLICY "Allow admins to toggle pinned status"
ON public.posts
FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'carunbtech23@ced.alliance.edu.in'
  OR auth.jwt() ->> 'email' = 'auconnecx@gmail.com'
  OR auth.jwt() ->> 'email' = 'gkartikay23@ced.alliance.edu.in'
  OR auth.jwt() ->> 'email' = 'shlok24@ced.alliance.edu.in'
  OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'carunbtech23@ced.alliance.edu.in'
  OR auth.jwt() ->> 'email' = 'auconnecx@gmail.com'
  OR auth.jwt() ->> 'email' = 'gkartikay23@ced.alliance.edu.in'
  OR auth.jwt() ->> 'email' = 'shlok24@ced.alliance.edu.in'
  OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);
