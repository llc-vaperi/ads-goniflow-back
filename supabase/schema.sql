-- Run this in the Supabase SQL editor for this project.
-- Creates the tables that src/controllers/projects.controller.ts expects.

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    link text default '',
    description text default '',
    logo_url text default '',
    created_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

create table if not exists public.saved_ads (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    platform text,
    tone text,
    headline text default '',
    text text not null,
    cta text default '',
    image_url text default '',
    created_at timestamptz not null default now()
);

create index if not exists saved_ads_project_id_idx on public.saved_ads(project_id);
create index if not exists saved_ads_user_id_idx on public.saved_ads(user_id);

alter table public.projects enable row level security;
alter table public.saved_ads enable row level security;

create policy "Users manage their own projects"
    on public.projects
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage their own saved ads"
    on public.saved_ads
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Storage bucket for project logos / saved-ad images.
insert into storage.buckets (id, name, public)
values ('ad-assets', 'ad-assets', true)
on conflict (id) do nothing;

create policy "Public read access to ad-assets"
    on storage.objects
    for select
    using (bucket_id = 'ad-assets');

create policy "Service role can manage ad-assets"
    on storage.objects
    for all
    using (bucket_id = 'ad-assets' and auth.role() = 'service_role')
    with check (bucket_id = 'ad-assets' and auth.role() = 'service_role');
