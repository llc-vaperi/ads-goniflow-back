-- RLS policy scaffold for ads-goniflow-back.
--
-- This is a STARTING POINT, not a verified fix: it documents the RLS policies
-- that SHOULD exist for every user-scoped table, mirroring the `user_id = auth.uid()`
-- ownership checks already enforced in the Express controllers (projects.controller.ts,
-- calendar.controller.ts). It cannot be verified from this repo — the live policies
-- (or absence of them) only exist in the Supabase project itself.
--
-- Before running this against a real database:
--   1. Confirm the actual column/table names match your schema (adjust if they differ).
--   2. Run `supabase db pull` first to capture whatever policies currently exist,
--      so this migration doesn't silently overwrite something already in place.
--   3. Apply in a staging project first and confirm the app still works end-to-end.

-- ── projects ────────────────────────────────────────────────────────────────
alter table if exists public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
    for select using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
    for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
    for delete using (auth.uid() = user_id);

-- ── saved_ads ───────────────────────────────────────────────────────────────
alter table if exists public.saved_ads enable row level security;

drop policy if exists "saved_ads_select_own" on public.saved_ads;
create policy "saved_ads_select_own" on public.saved_ads
    for select using (auth.uid() = user_id);

drop policy if exists "saved_ads_insert_own" on public.saved_ads;
create policy "saved_ads_insert_own" on public.saved_ads
    for insert with check (auth.uid() = user_id);

drop policy if exists "saved_ads_update_own" on public.saved_ads;
create policy "saved_ads_update_own" on public.saved_ads
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_ads_delete_own" on public.saved_ads;
create policy "saved_ads_delete_own" on public.saved_ads
    for delete using (auth.uid() = user_id);

-- ── calendar_events ─────────────────────────────────────────────────────────
alter table if exists public.calendar_events enable row level security;

drop policy if exists "calendar_events_select_own" on public.calendar_events;
create policy "calendar_events_select_own" on public.calendar_events
    for select using (auth.uid() = user_id);

drop policy if exists "calendar_events_insert_own" on public.calendar_events;
create policy "calendar_events_insert_own" on public.calendar_events
    for insert with check (auth.uid() = user_id);

drop policy if exists "calendar_events_update_own" on public.calendar_events;
create policy "calendar_events_update_own" on public.calendar_events
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "calendar_events_delete_own" on public.calendar_events;
create policy "calendar_events_delete_own" on public.calendar_events
    for delete using (auth.uid() = user_id);
