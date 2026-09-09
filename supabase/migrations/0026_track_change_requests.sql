-- Track audio change requests: an artist uploads a replacement file for a
-- track (wrong file, remaster, ...) with a reason, and an admin approves or
-- rejects it. The replacement file sits in the audio bucket but goes live
-- only when an approval swaps it into drop_tracks.audio_file_path.

create table if not exists public.track_change_requests (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.drop_tracks (id) on delete cascade,
  drop_id uuid not null references public.drops (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  new_audio_path text not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

comment on table public.track_change_requests is
  'Artist-submitted replacement audio files awaiting admin approval.';

-- One live request per track so approvals can't race each other.
create unique index if not exists idx_track_change_requests_pending_track
  on public.track_change_requests (track_id)
  where status = 'pending';

create index if not exists idx_track_change_requests_status
  on public.track_change_requests (status, created_at);
create index if not exists idx_track_change_requests_artist
  on public.track_change_requests (artist_id, status);

alter table public.track_change_requests enable row level security;

create policy "artist can read own change requests"
  on public.track_change_requests for select
  using (auth.uid() = artist_id);

create policy "artist can request own track changes"
  on public.track_change_requests for insert
  with check (auth.uid() = artist_id);

create policy "artist can cancel own pending requests"
  on public.track_change_requests for delete
  using (auth.uid() = artist_id and status = 'pending');

create policy "admin can manage all change requests"
  on public.track_change_requests for all
  using (is_admin());
