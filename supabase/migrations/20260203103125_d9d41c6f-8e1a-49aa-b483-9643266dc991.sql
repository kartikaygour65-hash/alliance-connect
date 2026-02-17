-- Create follow_requests table for private account follow requests
CREATE TABLE public.follow_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    target_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(requester_id, target_id)
);

-- Enable Row Level Security
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for follow requests
CREATE POLICY "Users can view their own sent requests"
ON public.follow_requests FOR SELECT
USING (auth.uid() = requester_id);

CREATE POLICY "Users can view requests sent to them"
ON public.follow_requests FOR SELECT
USING (auth.uid() = target_id);

CREATE POLICY "Users can create follow requests"
ON public.follow_requests FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update requests sent to them"
ON public.follow_requests FOR UPDATE
USING (auth.uid() = target_id);

CREATE POLICY "Users can delete their own requests"
ON public.follow_requests FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Create user_settings table for persisting settings
CREATE TABLE public.user_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    dark_mode BOOLEAN NOT NULL DEFAULT true,
    show_activity_status BOOLEAN NOT NULL DEFAULT true,
    likes_notifications BOOLEAN NOT NULL DEFAULT true,
    comments_notifications BOOLEAN NOT NULL DEFAULT true,
    follows_notifications BOOLEAN NOT NULL DEFAULT true,
    messages_notifications BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user settings
CREATE POLICY "Users can view their own settings"
ON public.user_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Create story_highlights table
CREATE TABLE public.story_highlights (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;

-- Create story_highlight_items table (junction table)
CREATE TABLE public.story_highlight_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    highlight_id UUID NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(highlight_id, story_id)
);

-- Enable Row Level Security
ALTER TABLE public.story_highlight_items ENABLE ROW LEVEL SECURITY;

-- Policies for story_highlights
CREATE POLICY "Anyone can view highlights"
ON public.story_highlights FOR SELECT
USING (true);

CREATE POLICY "Users can create their own highlights"
ON public.story_highlights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights"
ON public.story_highlights FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
ON public.story_highlights FOR DELETE
USING (auth.uid() = user_id);

-- Policies for story_highlight_items
CREATE POLICY "Anyone can view highlight items"
ON public.story_highlight_items FOR SELECT
USING (true);

CREATE POLICY "Highlight owners can insert items"
ON public.story_highlight_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.story_highlights
        WHERE id = highlight_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Highlight owners can delete items"
ON public.story_highlight_items FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.story_highlights
        WHERE id = highlight_id AND user_id = auth.uid()
    )
);

-- Create triggers for updated_at
CREATE TRIGGER update_follow_requests_updated_at
BEFORE UPDATE ON public.follow_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_story_highlights_updated_at
BEFORE UPDATE ON public.story_highlights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();