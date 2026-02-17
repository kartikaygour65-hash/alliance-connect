-- =========================================================
-- MASTER ADMIN PERMISSIONS FIX (SECRET ROOM & MARKETPLACE)
-- =========================================================

-- 1. Ensure the specifically mentioned admins HAVE the admin role in the DB
-- This is critical because RLS uses the 'has_role' function
DO $$
DECLARE
    admin_id UUID;
BEGIN
    -- Add Arun
    SELECT id INTO admin_id FROM auth.users WHERE email = 'arunchoudhary@alliance.edu.in' LIMIT 1;
    IF admin_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    -- Add Koki if identifiable (using username if available in profiles)
    SELECT user_id INTO admin_id FROM public.profiles WHERE username = 'koki' LIMIT 1;
    IF admin_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;

-- 2. REPAIR CONFESSIONS DELETE POLICY
-- The old policy only allowed owners to delete. This adds the ADMIN override.
DROP POLICY IF EXISTS "Users can delete own confessions" ON public.confessions;
DROP POLICY IF EXISTS "Creators and Admins can delete confessions" ON public.confessions;

CREATE POLICY "Creators and Admins can delete confessions"
ON public.confessions
FOR DELETE
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 3. REPAIR MARKETPLACE DELETE POLICY
DROP POLICY IF EXISTS "Sellers can delete" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Sellers and Admins can delete listings" ON public.marketplace_listings;

CREATE POLICY "Sellers and Admins can delete listings"
ON public.marketplace_listings
FOR DELETE
USING (
    auth.uid() = seller_id 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 4. REPAIR DIRECT MESSAGES DELETE POLICY (For moderation)
DROP POLICY IF EXISTS "Senders can delete own messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Senders and Admins can delete messages" ON public.direct_messages;

CREATE POLICY "Senders and Admins can delete messages"
ON public.direct_messages
FOR DELETE
USING (
    auth.uid() = sender_id 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 5. REPAIR VIEW for real-time consistency
-- Ensure the fetch view doesn't have any strange caching
NOTIFY pgrst, 'reload schema';
