-- =============================================
-- AUCONNECT COMPREHENSIVE SCHEMA MIGRATION (FIXED ORDER)
-- =============================================

-- 1. USER ROLES SYSTEM (Security-first approach)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. STORIES (24-hour expiry)
CREATE TABLE public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video', 'text')),
    background_color TEXT DEFAULT '#6366f1',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    view_count INTEGER DEFAULT 0
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stories viewable when not expired" ON public.stories
FOR SELECT USING (expires_at > now());

CREATE POLICY "Users can create own stories" ON public.stories
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories" ON public.stories
FOR DELETE USING (auth.uid() = user_id);

-- Story viewers tracking
CREATE TABLE public.story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
    viewer_id UUID NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (story_id, viewer_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Story owners can see viewers" ON public.story_views
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid())
);

CREATE POLICY "Users can record views" ON public.story_views
FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- 3. SECRET ROOM (Anonymous Confessions)
CREATE TABLE public.confessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    user_id UUID NOT NULL,
    is_highlighted BOOLEAN DEFAULT false,
    aura_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT true,
    is_reported BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved confessions viewable by all" ON public.confessions
FOR SELECT USING (is_approved = true);

CREATE POLICY "Users can create confessions" ON public.confessions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own confessions" ON public.confessions
FOR DELETE USING (auth.uid() = user_id);

-- Confession comments (anonymous)
CREATE TABLE public.confession_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confession_id UUID REFERENCES public.confessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.confession_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Confession comments viewable" ON public.confession_comments
FOR SELECT USING (true);

CREATE POLICY "Users can create confession comments" ON public.confession_comments
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own confession comments" ON public.confession_comments
FOR DELETE USING (auth.uid() = user_id);

-- Confession auras
CREATE TABLE public.confession_auras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confession_id UUID REFERENCES public.confessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (confession_id, user_id)
);

ALTER TABLE public.confession_auras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Confession auras viewable" ON public.confession_auras
FOR SELECT USING (true);

CREATE POLICY "Users can give confession aura" ON public.confession_auras
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove confession aura" ON public.confession_auras
FOR DELETE USING (auth.uid() = user_id);

-- 4. CIRCLES (Communities/Clubs) - CREATE ALL TABLES FIRST
CREATE TYPE public.circle_role AS ENUM ('admin', 'moderator', 'member');

CREATE TABLE public.circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    is_private BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    member_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    role circle_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (circle_id, user_id)
);

CREATE TABLE public.circle_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE NOT NULL,
    invited_user_id UUID NOT NULL,
    invited_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (circle_id, invited_user_id)
);

CREATE TABLE public.circle_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    content TEXT,
    images TEXT[],
    aura_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.circle_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Now enable RLS and create policies for circles
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public circles viewable" ON public.circles
FOR SELECT USING (is_private = false OR EXISTS (
    SELECT 1 FROM public.circle_members WHERE circle_id = id AND user_id = auth.uid()
));

CREATE POLICY "Users can create circles" ON public.circles
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Circle admins can update" ON public.circles
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = id AND user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Circle members viewable" ON public.circle_members
FOR SELECT USING (true);

CREATE POLICY "Users can join public circles" ON public.circle_members
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
        NOT EXISTS (SELECT 1 FROM public.circles WHERE id = circle_id AND is_private = true)
        OR EXISTS (SELECT 1 FROM public.circle_invites WHERE circle_id = circle_members.circle_id AND invited_user_id = auth.uid())
    )
);

CREATE POLICY "Users can leave circles" ON public.circle_members
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can see their invites" ON public.circle_invites
FOR SELECT USING (auth.uid() = invited_user_id);

CREATE POLICY "Circle admins can invite" ON public.circle_invites
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_invites.circle_id AND user_id = auth.uid() AND role IN ('admin', 'moderator'))
);

CREATE POLICY "Circle members can view posts" ON public.circle_posts
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_posts.circle_id AND user_id = auth.uid())
);

CREATE POLICY "Circle members can create posts" ON public.circle_posts
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_posts.circle_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete own circle posts" ON public.circle_posts
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Circle members can view messages" ON public.circle_messages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_messages.circle_id AND user_id = auth.uid())
);

CREATE POLICY "Circle members can send messages" ON public.circle_messages
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_messages.circle_id AND user_id = auth.uid())
);

-- 5. EVENTS
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    location TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID NOT NULL,
    rsvp_count INTEGER DEFAULT 0,
    is_campus_wide BOOLEAN DEFAULT true,
    circle_id UUID REFERENCES public.circles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events viewable" ON public.events FOR SELECT USING (true);
CREATE POLICY "Users can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update events" ON public.events FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete events" ON public.events FOR DELETE USING (auth.uid() = created_by);

CREATE TABLE public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    status TEXT CHECK (status IN ('going', 'interested', 'not_going')) DEFAULT 'going',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RSVPs viewable" ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users can RSVP" ON public.event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own RSVP" ON public.event_rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove RSVP" ON public.event_rsvps FOR DELETE USING (auth.uid() = user_id);

-- 6. INTERNSHIPS
CREATE TABLE public.internships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT,
    location TEXT,
    stipend TEXT,
    duration TEXT,
    apply_link TEXT,
    posted_by UUID NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internships viewable" ON public.internships FOR SELECT USING (is_active = true);
CREATE POLICY "Users can post internships" ON public.internships FOR INSERT WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Posters can update" ON public.internships FOR UPDATE USING (auth.uid() = posted_by);

-- 7. STUDY GROUPS
CREATE TABLE public.study_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    description TEXT,
    max_members INTEGER DEFAULT 10,
    current_members INTEGER DEFAULT 1,
    meeting_time TEXT,
    location TEXT,
    created_by UUID NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Study groups viewable" ON public.study_groups FOR SELECT USING (is_active = true);
CREATE POLICY "Users can create study groups" ON public.study_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update" ON public.study_groups FOR UPDATE USING (auth.uid() = created_by);

CREATE TABLE public.study_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.study_groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);

ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members viewable" ON public.study_group_members FOR SELECT USING (true);
CREATE POLICY "Users can join" ON public.study_group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave" ON public.study_group_members FOR DELETE USING (auth.uid() = user_id);

-- 8. LOST & FOUND
CREATE TABLE public.lost_found (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('lost', 'found')) NOT NULL,
    location TEXT,
    images TEXT[],
    contact_info TEXT,
    posted_by UUID NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lost_found ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lost found viewable" ON public.lost_found FOR SELECT USING (true);
CREATE POLICY "Users can post" ON public.lost_found FOR INSERT WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Posters can update" ON public.lost_found FOR UPDATE USING (auth.uid() = posted_by);
CREATE POLICY "Posters can delete" ON public.lost_found FOR DELETE USING (auth.uid() = posted_by);

-- 9. MARKETPLACE
CREATE TABLE public.marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category TEXT CHECK (category IN ('books', 'electronics', 'clothing', 'furniture', 'services', 'other')) NOT NULL,
    images TEXT[],
    status TEXT CHECK (status IN ('available', 'sold', 'reserved')) DEFAULT 'available',
    seller_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings viewable" ON public.marketplace_listings FOR SELECT USING (true);
CREATE POLICY "Sellers can create" ON public.marketplace_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update" ON public.marketplace_listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete" ON public.marketplace_listings FOR DELETE USING (auth.uid() = seller_id);

-- 10. ANONYMOUS POLLS
CREATE TABLE public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_by UUID NOT NULL,
    is_anonymous BOOLEAN DEFAULT true,
    ends_at TIMESTAMP WITH TIME ZONE,
    total_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Polls viewable" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Users can create polls" ON public.polls FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update polls" ON public.polls FOR UPDATE USING (auth.uid() = created_by);

CREATE TABLE public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (poll_id, user_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see if they voted" ON public.poll_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can vote" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 11. REPORTS (Moderation)
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL,
    content_type TEXT CHECK (content_type IN ('post', 'comment', 'confession', 'user', 'circle_post', 'message')) NOT NULL,
    content_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')) DEFAULT 'pending',
    reviewed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Moderators can view reports" ON public.reports FOR SELECT USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can update reports" ON public.reports FOR UPDATE USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- 12. DIRECT MESSAGES
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_1 UUID NOT NULL,
    participant_2 UUID NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (participant_1, participant_2)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view messages" ON public.direct_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND (participant_1 = auth.uid() OR participant_2 = auth.uid()))
);

CREATE POLICY "Conversation participants can send messages" ON public.direct_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND (participant_1 = auth.uid() OR participant_2 = auth.uid()))
);

CREATE POLICY "Senders can delete own messages" ON public.direct_messages FOR DELETE USING (auth.uid() = sender_id);

-- 13. NOTIFICATIONS
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT CHECK (type IN ('aura', 'comment', 'follow', 'circle_invite', 'event_invite', 'message', 'mention')) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- 14. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace', 'marketplace', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('events', 'events', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('circles', 'circles', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('lost-found', 'lost-found', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('chat', 'chat', true);

-- Storage policies for all buckets
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);

-- 15. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confessions;

-- 16. TRIGGERS FOR COUNTS
CREATE OR REPLACE FUNCTION public.update_confession_aura_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.confessions SET aura_count = aura_count + 1 WHERE id = NEW.confession_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.confessions SET aura_count = aura_count - 1 WHERE id = OLD.confession_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER update_confession_aura_count_trigger
AFTER INSERT OR DELETE ON public.confession_auras
FOR EACH ROW EXECUTE FUNCTION public.update_confession_aura_count();

CREATE OR REPLACE FUNCTION public.update_confession_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.confessions SET comments_count = comments_count + 1 WHERE id = NEW.confession_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.confessions SET comments_count = comments_count - 1 WHERE id = OLD.confession_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER update_confession_comment_count_trigger
AFTER INSERT OR DELETE ON public.confession_comments
FOR EACH ROW EXECUTE FUNCTION public.update_confession_comment_count();

CREATE OR REPLACE FUNCTION public.update_circle_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.circles SET member_count = member_count + 1 WHERE id = NEW.circle_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.circles SET member_count = member_count - 1 WHERE id = OLD.circle_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER update_circle_member_count_trigger
AFTER INSERT OR DELETE ON public.circle_members
FOR EACH ROW EXECUTE FUNCTION public.update_circle_member_count();

CREATE OR REPLACE FUNCTION public.update_event_rsvp_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.events SET rsvp_count = rsvp_count - 1 WHERE id = OLD.event_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER update_event_rsvp_count_trigger
AFTER INSERT OR DELETE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.update_event_rsvp_count();

CREATE OR REPLACE FUNCTION public.update_study_group_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.study_groups SET current_members = current_members + 1 WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.study_groups SET current_members = current_members - 1 WHERE id = OLD.group_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER update_study_group_member_count_trigger
AFTER INSERT OR DELETE ON public.study_group_members
FOR EACH ROW EXECUTE FUNCTION public.update_study_group_member_count();

CREATE OR REPLACE FUNCTION public.update_story_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_story_view_count_trigger
AFTER INSERT ON public.story_views
FOR EACH ROW EXECUTE FUNCTION public.update_story_view_count();