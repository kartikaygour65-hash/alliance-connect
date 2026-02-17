-- Ensure pulse_signals table exists
create table if not exists public.pulse_signals (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  category text default 'general',
  venue text,
  event_time text,
  priority boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone
);

-- Enable RLS
alter table public.pulse_signals enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Anyone can view pulse signals" on public.pulse_signals;
drop policy if exists "Admins can insert pulse signals" on public.pulse_signals;
drop policy if exists "Admins can update pulse signals" on public.pulse_signals;
drop policy if exists "Admins can delete pulse signals" on public.pulse_signals;

-- Policy for reading (anyone can read)
create policy "Anyone can view pulse signals"
on public.pulse_signals for select
using (true);

-- Policy for inserting (only admins and specific users)
create policy "Admins can insert pulse signals"
on public.pulse_signals for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and (profiles.role = 'admin' OR profiles.username IN ('arun', 'koki'))
  )
  OR auth.jwt() ->> 'email' IN ('carunbtech23@ced.alliance.edu.in', 'gkartikay23@ced.alliance.edu.in')
);

-- Policy for updating (only admins and specific users)
create policy "Admins can update pulse signals"
on public.pulse_signals for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and (profiles.role = 'admin' OR profiles.username IN ('arun', 'koki'))
  )
  OR auth.jwt() ->> 'email' IN ('carunbtech23@ced.alliance.edu.in', 'gkartikay23@ced.alliance.edu.in')
);

-- Policy for deleting (only admins and specific users)
create policy "Admins can delete pulse signals"
on public.pulse_signals for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and (profiles.role = 'admin' OR profiles.username IN ('arun', 'koki'))
  )
  OR auth.jwt() ->> 'email' IN ('carunbtech23@ced.alliance.edu.in', 'gkartikay23@ced.alliance.edu.in')
);
