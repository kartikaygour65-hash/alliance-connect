-- Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feedback', 'contact', 'other')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Clean up old policies to avoid "already exists" error
DROP POLICY IF EXISTS "Users can create support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;

-- Allow users to create tickets
CREATE POLICY "Users can create support tickets" 
ON public.support_tickets FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all tickets
CREATE POLICY "Admins can view all support tickets" 
ON public.support_tickets FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'developer') 
  OR 
  (auth.uid() = user_id) -- Users can see their own
);

-- Allow admins to update tickets (close them)
CREATE POLICY "Admins can update support tickets" 
ON public.support_tickets FOR UPDATE 
TO authenticated 
USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'developer'));


NOTIFY pgrst, 'reload schema';
