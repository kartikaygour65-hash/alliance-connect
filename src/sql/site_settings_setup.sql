-- =========================================================
-- SITE SETTINGS & THEME OVERRIDES
-- =============================================

-- 1. Create site_settings table for global app configuration
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 2. Policies
-- Everyone can read settings
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings"
ON public.site_settings FOR SELECT
USING (true);

-- Only admins can modify
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings"
ON public.site_settings FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR auth.jwt() ->> 'email' = 'arunchoudhary@alliance.edu.in'
);

-- 3. Seed initial default values (optional, but good for structure)
INSERT INTO public.site_settings (key, value, description)
VALUES 
('mess_menu_thumbnail', 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop', 'Thumbnail for the Mess Menu box'),
('leaderboard_thumbnail', 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop', 'Thumbnail for the Aura Rank Clash box')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
