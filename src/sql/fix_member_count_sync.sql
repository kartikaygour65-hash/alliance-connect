-- ==========================================
-- FIX: Circle Member Count Sync
-- Fixes the mismatch between member_count column and actual members.
-- Also prevents member_count from going negative.
-- Run this in Supabase SQL Editor.
-- ==========================================

-- 1. RESYNC all circle member counts from actual data
UPDATE public.circles c
SET member_count = (
  SELECT COUNT(*)
  FROM public.circle_members cm
  WHERE cm.circle_id = c.id
);

-- 2. Fix any negative counts to 0
UPDATE public.circles
SET member_count = 0
WHERE member_count < 0;

-- 3. Replace the trigger function with a safer version that:
--    a) Uses GREATEST(0, ...) to never go below 0
--    b) Handles edge cases properly
CREATE OR REPLACE FUNCTION public.update_circle_member_count()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.circles
    SET member_count = (
      SELECT COUNT(*) FROM public.circle_members WHERE circle_id = NEW.circle_id
    )
    WHERE id = NEW.circle_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.circles
    SET member_count = GREATEST(0, (
      SELECT COUNT(*) FROM public.circle_members WHERE circle_id = OLD.circle_id
    ))
    WHERE id = OLD.circle_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the trigger (safe drop + create)
DROP TRIGGER IF EXISTS on_circle_member_change ON public.circle_members;

CREATE TRIGGER on_circle_member_change
AFTER INSERT OR DELETE ON public.circle_members
FOR EACH ROW EXECUTE PROCEDURE public.update_circle_member_count();
