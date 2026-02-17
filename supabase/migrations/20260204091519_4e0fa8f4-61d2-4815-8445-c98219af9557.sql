-- Add duration column to stories table
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS duration integer DEFAULT 5;

-- Create trigger function for follow request notifications
CREATE OR REPLACE FUNCTION public.notify_on_follow_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  requester_name TEXT;
BEGIN
  -- Get the requester's name
  SELECT full_name INTO requester_name FROM public.profiles WHERE user_id = NEW.requester_id;
  
  -- Create notification for the target user
  PERFORM public.create_notification(
    NEW.target_id,
    'follow_request',
    'Follow Request',
    COALESCE(requester_name, 'Someone') || ' wants to follow you',
    jsonb_build_object('requester_id', NEW.requester_id, 'request_id', NEW.id)
  );
  
  RETURN NEW;
END;
$function$;

-- Drop the trigger if it exists, then create it
DROP TRIGGER IF EXISTS on_follow_request_created ON public.follow_requests;

CREATE TRIGGER on_follow_request_created
AFTER INSERT ON public.follow_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_follow_request();

-- Enable realtime on follow_requests if not already
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_requests;