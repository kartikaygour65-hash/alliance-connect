-- Enable storage if not already
insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

-- Drop existing policies if they exist to avoid conflicts
drop policy if exists "Public Access Events Posters" on storage.objects;
drop policy if exists "Authenticated users can upload event posters" on storage.objects;
drop policy if exists "Users can delete their own event posters" on storage.objects;

-- Create storage policies
create policy "Public Access Events Posters"
  on storage.objects for select
  using ( bucket_id = 'event-posters' );

create policy "Authenticated users can upload event posters"
  on storage.objects for insert
  with check ( bucket_id = 'event-posters' and auth.role() = 'authenticated' );

create policy "Users can delete their own event posters"
  on storage.objects for delete
  using ( bucket_id = 'event-posters' and owner = auth.uid() );


-- Ensure events table has cover_url
alter table public.events 
add column if not exists cover_url text;

-- Add RLS policies for events if not exist
alter table public.events enable row level security;

-- Drop event policies if they exist
drop policy if exists "Events are viewable by everyone" on public.events;
drop policy if exists "Users can create events" on public.events;
drop policy if exists "Users can update their own events" on public.events;
drop policy if exists "Users can delete their own events" on public.events;

-- Create event policies
create policy "Events are viewable by everyone"
  on public.events for select
  using ( true );

create policy "Users can create events"
  on public.events for insert
  with check ( auth.role() = 'authenticated' );

create policy "Users can update their own events"
  on public.events for update
  using ( auth.uid() = created_by );

create policy "Users can delete their own events"
  on public.events for delete
  using ( auth.uid() = created_by );
