-- Update posts RLS policy to hide posts from private accounts unless following
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Posts are viewable by owner or if account is public or if following" ON public.posts;

-- Create new policy: posts visible if own post, account is public, or user follows the author
CREATE POLICY "Posts are viewable based on privacy"
ON public.posts
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = posts.user_id
    AND (p.is_private = false OR p.is_private IS NULL)
  )
  OR EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = auth.uid()
    AND f.following_id = posts.user_id
  )
);

-- Create a function to calculate total aura for a user from all their posts
CREATE OR REPLACE FUNCTION public.update_user_total_aura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id UUID;
  new_total_aura BIGINT;
BEGIN
  -- Get the post owner's user_id
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO post_owner_id FROM public.posts WHERE id = OLD.post_id;
  ELSE
    SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  END IF;
  
  -- Calculate total aura from all posts
  SELECT COALESCE(SUM(aura_count), 0) INTO new_total_aura
  FROM public.posts
  WHERE user_id = post_owner_id;
  
  -- Update the user's profile
  UPDATE public.profiles
  SET total_aura = new_total_aura
  WHERE user_id = post_owner_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update total_aura when posts aura changes
DROP TRIGGER IF EXISTS update_total_aura_on_aura_change ON public.auras;
CREATE TRIGGER update_total_aura_on_aura_change
AFTER INSERT OR DELETE ON public.auras
FOR EACH ROW
EXECUTE FUNCTION public.update_user_total_aura();

-- Also recalculate all existing users' total_aura
UPDATE public.profiles p
SET total_aura = (
  SELECT COALESCE(SUM(aura_count), 0)
  FROM public.posts
  WHERE user_id = p.user_id
);