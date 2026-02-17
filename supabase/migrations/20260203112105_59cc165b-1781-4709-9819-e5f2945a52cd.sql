-- Add saved_collections table for organizing saved posts like Instagram
CREATE TABLE public.saved_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add collection_id to saved_posts
ALTER TABLE public.saved_posts ADD COLUMN collection_id UUID REFERENCES public.saved_collections(id) ON DELETE SET NULL;

-- Enable RLS on saved_collections
ALTER TABLE public.saved_collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_collections
CREATE POLICY "Users can view their own collections" ON public.saved_collections 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own collections" ON public.saved_collections 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections" ON public.saved_collections 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections" ON public.saved_collections 
FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_saved_collections_updated_at
BEFORE UPDATE ON public.saved_collections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to insert notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_data JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger to create notification on new follow
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT full_name INTO follower_name FROM public.profiles WHERE user_id = NEW.follower_id;
  
  PERFORM public.create_notification(
    NEW.following_id,
    'follow',
    'New Follower',
    COALESCE(follower_name, 'Someone') || ' started following you',
    jsonb_build_object('follower_id', NEW.follower_id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_follow();

-- Trigger to create notification on new aura (like)
CREATE OR REPLACE FUNCTION public.notify_on_aura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  liker_name TEXT;
  post_owner_id UUID;
BEGIN
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't notify if user likes own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  SELECT full_name INTO liker_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  PERFORM public.create_notification(
    post_owner_id,
    'like',
    'New Like',
    COALESCE(liker_name, 'Someone') || ' liked your post',
    jsonb_build_object('user_id', NEW.user_id, 'post_id', NEW.post_id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_aura
AFTER INSERT ON public.auras
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_aura();

-- Trigger to create notification on new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commenter_name TEXT;
  post_owner_id UUID;
BEGIN
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't notify if user comments on own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  SELECT full_name INTO commenter_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  PERFORM public.create_notification(
    post_owner_id,
    'comment',
    'New Comment',
    COALESCE(commenter_name, 'Someone') || ' commented on your post',
    jsonb_build_object('user_id', NEW.user_id, 'post_id', NEW.post_id, 'comment_id', NEW.id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment();

-- Trigger to create notification on follow request
CREATE OR REPLACE FUNCTION public.notify_on_follow_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_name TEXT;
BEGIN
  SELECT full_name INTO requester_name FROM public.profiles WHERE user_id = NEW.requester_id;
  
  PERFORM public.create_notification(
    NEW.target_id,
    'follow_request',
    'Follow Request',
    COALESCE(requester_name, 'Someone') || ' wants to follow you',
    jsonb_build_object('requester_id', NEW.requester_id, 'request_id', NEW.id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_follow_request
AFTER INSERT ON public.follow_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_follow_request();