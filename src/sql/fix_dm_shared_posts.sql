-- ==========================================
-- FIX DM SHARED POSTS & REELS
-- Run this to enable Post Thumbnails in Chat
-- ==========================================

-- 1. Ensure shared_post_id exists and is a Foreign Key
alter table "public"."direct_messages" 
add column if not exists "shared_post_id" uuid;

-- Drop existing constraint if it exists to ensure clean start (optional but safer)
alter table "public"."direct_messages" 
drop constraint if exists "direct_messages_shared_post_id_fkey";

-- Add the Foreign Key
alter table "public"."direct_messages"
add constraint "direct_messages_shared_post_id_fkey"
foreign key ("shared_post_id")
references "public"."posts" ("id")
on delete set null;

-- 2. Ensure stories have 'is_beam' column (for Beam to Story feature)
alter table "public"."stories"
add column if not exists "is_beam" boolean default false;

alter table "public"."stories"
add column if not exists "post_id" uuid references "public"."posts"("id") on delete cascade;

-- 3. RLS: Direct Messages should be accessible to participants
-- Re-applying granular RLS for DMs just in case
alter table "public"."direct_messages" enable row level security;
drop policy if exists "Enable all access for authenticated users to direct_messages" on "public"."direct_messages";

create policy "View DMs (Participants)"
on "public"."direct_messages" for select
to authenticated
using (
  auth.uid() = sender_id OR 
  exists (
    select 1 from conversations c
    where c.id = direct_messages.conversation_id
    and (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);

create policy "Send DMs"
on "public"."direct_messages" for insert
to authenticated
with check (auth.uid() = sender_id);

create policy "Delete own DMs"
on "public"."direct_messages" for delete
to authenticated
using (auth.uid() = sender_id);
