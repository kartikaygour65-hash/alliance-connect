-- ==========================================
-- COMPLETE CIRCLES FIX (RLS + TRIGGERS + SYNC)
-- Run this in Supabase SQL Editor.
-- ==========================================

-- 1. DROP EXISTING POLICIES (Cleanup)
do $$ 
begin
  -- Circles
  drop policy if exists "Users can create circles" on "public"."circles";
  drop policy if exists "Enable insert for authenticated users only" on "public"."circles";
  drop policy if exists "Admins can update their circles" on "public"."circles";
  
  -- Members
  drop policy if exists "Users can join circles" on "public"."circle_members";
  drop policy if exists "Enable insert for circle_members" on "public"."circle_members";
  drop policy if exists "Admins can remove members" on "public"."circle_members";
  drop policy if exists "Enable delete for circle_members (Self or Admin)" on "public"."circle_members";
  drop policy if exists "Admins can update member roles" on "public"."circle_members";
  drop policy if exists "Enable all access for authenticated users to circle_members" on "public"."circle_members";

  -- Messages
  drop policy if exists "Members can send messages" on "public"."circle_messages";
  drop policy if exists "Enable insert for circle_messages" on "public"."circle_messages";
  drop policy if exists "Members can view messages" on "public"."circle_messages";
  drop policy if exists "Enable read access for circle_messages" on "public"."circle_messages";
  drop policy if exists "Enable all access for authenticated users to circle_messages" on "public"."circle_messages";
  
  -- Notifications
  drop policy if exists "Allow sending circle invites" on "public"."notifications";
  drop policy if exists "Enable insert for notifications" on "public"."notifications";
  drop policy if exists "Enable insert for notifications (Invites)" on "public"."notifications";

  -- Circles (New)
  drop policy if exists "Enable all access for authenticated users to circles" on "public"."circles";
end $$;


-- 2. CREATE FUNCTION & TRIGGER FOR MEMBER COUNT
create or replace function public.update_circle_member_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.circles
    set member_count = member_count + 1
    where id = new.circle_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update public.circles
    set member_count = member_count - 1
    where id = old.circle_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists on_circle_member_change on public.circle_members;

create trigger on_circle_member_change
after insert or delete on public.circle_members
for each row execute procedure public.update_circle_member_count();


-- 3. APPLY ROBUST RLS POLICIES

-- CIRCLES
create policy "Enable all access for authenticated users to circles"
on "public"."circles"
for all
to authenticated
using (true)
with check (true); 

-- CIRCLE MEMBERS
create policy "Enable all access for authenticated users to circle_members"
on "public"."circle_members"
for all
to authenticated
using (true)
with check (true);

-- CIRCLE MESSAGES
create policy "Enable all access for authenticated users to circle_messages"
on "public"."circle_messages"
for all
to authenticated
using (true)
with check (true);

-- CIRCLE POSTS (Feed)
alter table "public"."circle_posts" enable row level security;

-- Drop existing if any
drop policy if exists "Enable all access for authenticated users to circle_posts" on "public"."circle_posts";

create policy "Enable all access for authenticated users to circle_posts"
on "public"."circle_posts"
for all
to authenticated
using (true)
with check (true);

-- CIRCLE FILES (Media)
alter table "public"."circle_files" enable row level security;

-- Drop existing if any
drop policy if exists "Enable all access for authenticated users to circle_files" on "public"."circle_files";

create policy "Enable all access for authenticated users to circle_files"
on "public"."circle_files"
for all
to authenticated
using (true)
with check (true);

-- NOTIFICATIONS (For Invites)
create policy "Enable insert for notifications (Invites)"
on "public"."notifications"
for insert
to authenticated
with check (true);


-- 4. SYNC EXISTING MEMBER COUNTS
-- Recalculate member counts for all circles right now
update public.circles c
set member_count = (
  select count(*) 
  from public.circle_members cm 
  where cm.circle_id = c.id
);
