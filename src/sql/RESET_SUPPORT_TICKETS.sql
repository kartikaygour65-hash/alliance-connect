-- =========================================================
-- COMPLETE RESET: Support Tickets Table
-- =========================================================

-- Drop everything related to support tickets to start fresh
DROP TABLE IF EXISTS public.support_tickets CASCADE;

-- Create Table
CREATE TABLE public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feedback', 'contact', 'other')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 1. Insert Policy: Authenticated users can create tickets for themselves
CREATE POLICY "Users can create support tickets" 
ON public.support_tickets FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 2. Select Policy: Admins see all, users see their own
CREATE POLICY "Admins view all tickets" 
ON public.support_tickets FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'developer') 
  OR 
  (auth.uid() = user_id)
);

-- 3. Update Policy: Admins can update status
CREATE POLICY "Admins update tickets" 
ON public.support_tickets FOR UPDATE 
TO authenticated 
USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'developer'));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
