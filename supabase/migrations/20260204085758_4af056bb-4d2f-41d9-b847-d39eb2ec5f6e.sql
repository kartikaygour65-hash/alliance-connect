-- Enable realtime for tables that aren't already members (use IF NOT EXISTS pattern)
DO $$ 
BEGIN
  -- Check and add each table individually
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auras') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auras;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'saved_posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_posts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'marketplace_listings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_listings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'story_views') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
  END IF;
END $$;

-- Add message_type column to direct_messages for media support
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Add commission info to marketplace_listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(4,2) DEFAULT 2.00;

-- Create marketplace inquiries table for buy/sell tracking
CREATE TABLE IF NOT EXISTS public.marketplace_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on marketplace_inquiries
ALTER TABLE public.marketplace_inquiries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.marketplace_inquiries;
DROP POLICY IF EXISTS "Users can create inquiries" ON public.marketplace_inquiries;
DROP POLICY IF EXISTS "Sellers can update inquiry status" ON public.marketplace_inquiries;

CREATE POLICY "Users can view their own inquiries"
  ON public.marketplace_inquiries FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create inquiries"
  ON public.marketplace_inquiries FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update inquiry status"
  ON public.marketplace_inquiries FOR UPDATE
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Enable realtime for inquiries
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'marketplace_inquiries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_inquiries;
  END IF;
END $$;

-- Create notification function for DM
CREATE OR REPLACE FUNCTION public.notify_on_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
  recipient_id UUID;
BEGIN
  SELECT 
    CASE 
      WHEN c.participant_1 = NEW.sender_id THEN c.participant_2
      ELSE c.participant_1
    END INTO recipient_id
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;
  
  IF recipient_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  
  PERFORM public.create_notification(
    recipient_id,
    'message',
    'New Message',
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    jsonb_build_object('sender_id', NEW.sender_id, 'conversation_id', NEW.conversation_id)
  );
  
  RETURN NEW;
END;
$$;

-- Create triggers for notifications
DROP TRIGGER IF EXISTS trigger_dm_notification ON public.direct_messages;
CREATE TRIGGER trigger_dm_notification
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_dm();

DROP TRIGGER IF EXISTS trigger_follow_request_notification ON public.follow_requests;
CREATE TRIGGER trigger_follow_request_notification
AFTER INSERT ON public.follow_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_follow_request();

DROP TRIGGER IF EXISTS trigger_aura_notification ON public.auras;
CREATE TRIGGER trigger_aura_notification
AFTER INSERT ON public.auras
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_aura();

DROP TRIGGER IF EXISTS trigger_comment_notification ON public.comments;
CREATE TRIGGER trigger_comment_notification
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS trigger_follow_notification ON public.follows;
CREATE TRIGGER trigger_follow_notification
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_follow();

-- Update timestamp trigger for inquiries
DROP TRIGGER IF EXISTS update_marketplace_inquiries_updated_at ON public.marketplace_inquiries;
CREATE TRIGGER update_marketplace_inquiries_updated_at
BEFORE UPDATE ON public.marketplace_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();