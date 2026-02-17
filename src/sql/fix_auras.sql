-- =========================================================
-- FIX: AURA (LIKES) PERSISTENCE & COUNTS - PRODUCTION GRADE
-- =========================================================

-- 1. Schema Check: Ensure 'auras' table exists
CREATE TABLE IF NOT EXISTS public.auras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Data Cleanup: Remove duplicate likes if any exist (Pre-constraint fix)
DELETE FROM public.auras a1
USING public.auras a2
WHERE a1.id > a2.id -- Keep the older one (or newer, doesn't matter much for likes)
  AND a1.user_id = a2.user_id
  AND a1.post_id = a2.post_id;

-- 3. Add Unique Constraint (Safe upsert behavior)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'auras_user_id_post_id_key'
    ) THEN
        ALTER TABLE "public"."auras" 
        ADD CONSTRAINT "auras_user_id_post_id_key" UNIQUE ("user_id", "post_id");
    END IF;
END $$;

-- 4. RLS Policies (Security)
ALTER TABLE public.auras ENABLE ROW LEVEL SECURITY;

-- Drop old policies to refresh
DROP POLICY IF EXISTS "View auras" ON public.auras;
DROP POLICY IF EXISTS "Create auras" ON public.auras;
DROP POLICY IF EXISTS "Delete auras" ON public.auras;
DROP POLICY IF EXISTS "Users can like posts" ON public.auras;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.auras;

-- Create Policies
CREATE POLICY "View auras" 
ON public.auras FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can like posts" 
ON public.auras FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" 
ON public.auras FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 5. AUTO-UPDATE AURA COUNT ON POSTS (Consistency)
CREATE OR REPLACE FUNCTION update_aura_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET aura_count = aura_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET aura_count = GREATEST(aura_count - 1, 0) -- Prevent negative counts
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS on_aura_added ON public.auras;
CREATE TRIGGER on_aura_added
AFTER INSERT ON public.auras
FOR EACH ROW
EXECUTE FUNCTION update_aura_count();

DROP TRIGGER IF EXISTS on_aura_removed ON public.auras;
CREATE TRIGGER on_aura_removed
AFTER DELETE ON public.auras
FOR EACH ROW
EXECUTE FUNCTION update_aura_count();


-- 6. RECALCULATE ALL COUNTS (One-time sync)
UPDATE public.posts p
SET aura_count = (
  SELECT count(*)
  FROM public.auras a
  WHERE a.post_id = p.id
);

NOTIFY pgrst, 'reload schema';
