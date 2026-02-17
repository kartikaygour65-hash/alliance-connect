-- =========================================================
-- FIX PRIVACY RLS & NOTIFICATION TRIGGERS
-- Implements Instagram-like Logic for Private Accounts
-- =========================================================

-- 1. HELPER FUNCTION: Check Access
-- Returns TRUE if user can view target's content (Self, Public, or Following)
create or replace function public.check_access(target_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select
    -- 1. Self
    (auth.uid() = target_id)
    OR
    -- 2. Public Profile
    exists (
      select 1 from profiles
      where user_id = target_id
      and (is_private is null or is_private = false)
    )
    OR
    -- 3. Follower
    exists (
      select 1 from follows
      where follower_id = auth.uid()
      and following_id = target_id
    );
$$;

-- 2. RLS FOR POSTS
alter table "public"."posts" enable row level security;
drop policy if exists "Enable all access for authenticated users to posts" on "public"."posts";
drop policy if exists "Public posts are visible to everyone" on "public"."posts";
drop policy if exists "Users can view relevant posts" on "public"."posts";

create policy "View posts (Privacy Aware)"
on "public"."posts" for select
to authenticated
using (
  public.check_access(user_id)
);

-- Re-apply Insert/Update/Delete (Owner only) policies if they were dropped by "Enable all"
create policy "Create posts" on "public"."posts" for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own posts" on "public"."posts" for update to authenticated using (auth.uid() = user_id);
create policy "Delete own posts" on "public"."posts" for delete to authenticated using (auth.uid() = user_id);


-- 3. RLS FOR STORIES
alter table "public"."stories" enable row level security;
drop policy if exists "Enable all access for authenticated users to stories" on "public"."stories";

create policy "View stories (Privacy Aware)"
on "public"."stories" for select
to authenticated
using (
  public.check_access(user_id)
);

create policy "Create stories" on "public"."stories" for insert to authenticated with check (auth.uid() = user_id);
create policy "Delete own stories" on "public"."stories" for delete to authenticated using (auth.uid() = user_id);


-- 4. NOTIFICATION TRIGGER: NEW FOLLOW
create or replace function public.handle_new_follow()
returns trigger
language plpgsql
security definer
as $$
declare
  follower_name text;
begin
  select username into follower_name from profiles where user_id = new.follower_id;

  insert into notifications (user_id, type, title, body, data, is_read)
  values (
    new.following_id,
    'follow',
    'New Follower',
    coalesce(follower_name, 'Someone') || ' started following you',
    jsonb_build_object('follower_id', new.follower_id),
    false
  );
  return new;
end;
$$;

drop trigger if exists on_follow_created on public.follows;
create trigger on_follow_created
after insert on public.follows
for each row execute procedure public.handle_new_follow();


-- 5. NOTIFICATION TRIGGER: FOLLOW REQUEST
create or replace function public.handle_new_follow_request()
returns trigger
language plpgsql
security definer
as $$
declare
  requester_name text;
begin
  select username into requester_name from profiles where user_id = new.requester_id;

  insert into notifications (user_id, type, title, body, data, is_read)
  values (
    new.target_id,
    'follow_request',
    'Follow Request',
    coalesce(requester_name, 'Someone') || ' wants to follow you',
    jsonb_build_object('requester_id', new.requester_id, 'request_id', new.id),
    false
  );
  return new;
end;
$$;

drop trigger if exists on_follow_request_created on public.follow_requests;
create trigger on_follow_request_created
after insert on public.follow_requests
for each row execute procedure public.handle_new_follow_request();

-- 6. FOLLOW ACCEPTED TRIGGER (Optional: Notify requester they were accepted)
create or replace function public.handle_follow_accepted()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into notifications (user_id, type, title, body, data, is_read)
    values (
      new.requester_id,
      'request_accepted',
      'Request Accepted',
      'Your follow request was accepted',
      jsonb_build_object('target_id', new.target_id),
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_follow_request_accepted on public.follow_requests;
create trigger on_follow_request_accepted
after update on public.follow_requests
for each row execute procedure public.handle_follow_accepted();
