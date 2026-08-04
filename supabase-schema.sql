-- MEPS Trip Coordinator PWA
-- Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.trips (
  id uuid primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  date date not null,
  "window" text not null,
  meps_location text not null,
  pickup_area text not null,
  departure_time text,
  return_eta text,
  primary_driver text not null,
  backup_driver text,
  vehicle text,
  seat_capacity integer not null default 7 check (seat_capacity between 1 and 20),
  status text not null default 'Planned',
  notes text,
  updated_at timestamptz not null default now(),
  unique (id, team_id)
);

create table if not exists public.riders (
  id uuid primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  trip_id uuid not null,
  applicant_ref text not null,
  recruiter text not null,
  pickup_location text,
  appointment_type text,
  hotel_needed boolean not null default false,
  status text not null default 'Requested',
  notes text,
  updated_at timestamptz not null default now(),
  foreign key (trip_id, team_id) references public.trips(id, team_id) on delete cascade
);

create table if not exists public.availability (
  id uuid primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  date date not null,
  member_name text not null,
  status text not null,
  has_vehicle boolean not null default false,
  seat_capacity integer not null default 0 check (seat_capacity between 0 and 20),
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.trips enable row level security;
alter table public.riders enable row level security;
alter table public.availability enable row level security;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

drop policy if exists "team members read teams" on public.teams;
create policy "team members read teams" on public.teams
for select to authenticated using (public.is_team_member(id));

drop policy if exists "team members read memberships" on public.team_members;
create policy "team members read memberships" on public.team_members
for select to authenticated using (public.is_team_member(team_id));

drop policy if exists "team members access trips" on public.trips;
create policy "team members access trips" on public.trips
for all to authenticated using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "team members access riders" on public.riders;
create policy "team members access riders" on public.riders
for all to authenticated using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "team members access availability" on public.availability;
create policy "team members access availability" on public.availability
for all to authenticated using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

create or replace function public.create_team(p_name text, p_display_name text)
returns table(team_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_join_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  loop
    v_join_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.teams where teams.join_code = v_join_code);
  end loop;

  insert into public.teams(name, join_code, created_by)
  values (trim(p_name), v_join_code, auth.uid())
  returning id into v_team_id;

  insert into public.team_members(team_id, user_id, display_name, role)
  values (v_team_id, auth.uid(), trim(p_display_name), 'admin');

  return query select v_team_id, v_join_code;
end;
$$;

create or replace function public.join_team(p_join_code text, p_display_name text)
returns table(team_id uuid, team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_team
  from public.teams
  where join_code = upper(trim(p_join_code));

  if v_team.id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.team_members(team_id, user_id, display_name, role)
  values (v_team.id, auth.uid(), trim(p_display_name), 'member')
  on conflict (team_id, user_id)
  do update set display_name = excluded.display_name;

  return query select v_team.id, v_team.name;
end;
$$;

-- Explicit Data API permissions. RLS still controls which rows are accessible.
grant select on public.teams, public.team_members to authenticated;
grant select, insert, update, delete on public.trips, public.riders, public.availability to authenticated;

-- SECURITY DEFINER functions are not callable by PUBLIC or anonymous users.
revoke all on function public.create_team(text, text) from public, anon;
revoke all on function public.join_team(text, text) from public, anon;
revoke all on function public.is_team_member(uuid) from public, anon;

grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.join_team(text, text) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;

-- Cover foreign keys and the most common team/date queries.
create index if not exists idx_teams_created_by on public.teams(created_by);
create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_trips_team_date on public.trips(team_id, date);
create index if not exists idx_riders_team_id on public.riders(team_id);
create index if not exists idx_riders_trip_team on public.riders(trip_id, team_id);
create index if not exists idx_availability_team_date on public.availability(team_id, date);
