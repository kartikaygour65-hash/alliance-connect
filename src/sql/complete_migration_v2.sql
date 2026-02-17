-- =========================================================
-- COMPLETE MIGRATION SCRIPT (ALL FIXES)
-- Run this ONCE to apply all recent features & fixes.
-- Includes:
-- 1. Stories RLS & View Tracking
-- 2. Chat Relationships (Foreign Keys)
-- 3. Chat Features (Reply, Delete, Granular RLS)
-- 4. Privacy System (Private/Public handling for Posts/Stories)
-- 5. Activity Notifications (Triggers for Follows/Requests)
-- 6. DM Shared Posts (Thumbnails & Beam)
-- =========================================================

-- PART 1: STORIES & VIEW TRACKING
-- Enable RLS
alter table "public"."stories" enable row level security;
alter table "public"."story_views" enable row level security;
alter table "public"."story_likes" enable row level security;

-- Policies for Story Views
drop policy if exists "Enable insert for authenticated users only" on "public"."story_views";
create policy "Insert story views"
on "public"."story_views" for insert
to authenticated
with check (auth.uid() = viewer_id);

drop policy if exists "Enable read access for all users" on "public"."story_views";
create policy "View story views"
on "public"."story_views" for select
to authenticated
using (true);

-- PART 2: CHAT RELATIONSHIPS & FEATURES
-- Foreign Keys
alter table "public"."circle_messages" 
add constraint "circle_messages_user_id_fkey_profiles" 
foreign key ("user_id") 
references "public"."profiles" ("user_id")
on delete cascade;

-- Reply Support
alter table "public"."circle_messages"
add column if not exists "reply_to_id" uuid references "public"."circle_messages"("id") on delete set null;

-- Chat RLS
alter table "public"."circle_messages" enable row level security;
drop policy if exists "Enable all access for authenticated users to circle_messages" on "public"."circle_messages";

create policy "View messages" on "public"."circle_messages" for select to authenticated using (true);

create policy "Send messages" on "public"."circle_messages" for insert to authenticated 
with check (exists (select 1 from circle_members where circle_id = circle_messages.circle_id and user_id = auth.uid()));

create policy "Edit own messages" on "public"."circle_messages" for update to authenticated using (user_id = auth.uid());

create policy "Delete messages (Owner or Admin)" on "public"."circle_messages" for delete to authenticated 
using (user_id = auth.uid() OR exists (select 1 from circle_members where circle_id = circle_messages.circle_id and user_id = auth.uid() and role in ('admin', 'moderator')));


-- PART 3: PRIVACY SYSTEM (CHECK ACCESS FUNCTION)
create or replace function public.check_access(target_id uuid)
returns boolean language sql security definer stable
as $$
  select (auth.uid() = target_id) OR exists (select 1 from profiles where user_id = target_id and (is_private is null or is_private = false)) OR exists (select 1 from follows where follower_id = auth.uid() and following_id = target_id);
$$;

-- Apply Privacy RLS to Posts & Stories
alter table "public"."posts" enable row level security;
drop policy if exists "Enable all access for authenticated users to posts" on "public"."posts";
create policy "View posts (Privacy Aware)" on "public"."posts" for select to authenticated using (public.check_access(user_id));
create policy "Create posts" on "public"."posts" for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own posts" on "public"."posts" for update to authenticated using (auth.uid() = user_id);
create policy "Delete own posts" on "public"."posts" for delete to authenticated using (auth.uid() = user_id);

alter table "public"."stories" enable row level security;
drop policy if exists "Enable all access for authenticated users to stories" on "public"."stories";
create policy "View stories (Privacy Aware)" on "public"."stories" for select to authenticated using (public.check_access(user_id));
create policy "Create stories" on "public"."stories" for insert to authenticated with check (auth.uid() = user_id);
create policy "Delete own stories" on "public"."stories" for delete to authenticated using (auth.uid() = user_id);


-- PART 4: ACTIVITY NOTIFICATIONS (TRIGGERS)
create or replace function public.handle_new_follow()
returns trigger language plpgsql security definer
as $$
declare follower_name text;
begin
  select username into follower_name from profiles where user_id = new.follower_id;
  insert into notifications (user_id, type, title, body, data, is_read)
  values (new.following_id, 'follow', 'New Follower', coalesce(follower_name, 'Someone') || ' started following you', jsonb_build_object('follower_id', new.follower_id), false);
  return new;
end;
$$;
drop trigger if exists on_follow_created on public.follows;
create trigger on_follow_created after insert on public.follows for each row execute procedure public.handle_new_follow();

create or replace function public.handle_new_follow_request()
returns trigger language plpgsql security definer
as $$
declare requester_name text;
begin
  select username into requester_name from profiles where user_id = new.requester_id;
  insert into notifications (user_id, type, title, body, data, is_read)
  values (new.target_id, 'follow_request', 'Follow Request', coalesce(requester_name, 'Someone') || ' wants to follow you', jsonb_build_object('requester_id', new.requester_id, 'request_id', new.id), false);
  return new;
end;
$$;
drop trigger if exists on_follow_request_created on public.follow_requests;
create trigger on_follow_request_created after insert on public.follow_requests for each row execute procedure public.handle_new_follow_request();


-- PART 5: DM SHARED POSTS (THUMBNAILS)
alter table "public"."direct_messages" add column if not exists "shared_post_id" uuid;
alter table "public"."direct_messages" drop constraint if exists "direct_messages_shared_post_id_fkey";
alter table "public"."direct_messages" add constraint "direct_messages_shared_post_id_fkey" foreign key ("shared_post_id") references "public"."posts" ("id") on delete set null;

-- Ensure Beam Logic
alter table "public"."stories" add column if not exists "is_beam" boolean default false;
alter table "public"."stories" add column if not exists "post_id" uuid references "public"."posts"("id") on delete cascade;

