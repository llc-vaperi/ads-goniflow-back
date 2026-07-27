-- Multi-admin authorization with database-managed roles and immutable audit.
-- The first owner is bootstrapped once through a service-role SQL call; after
-- that, active owners manage all memberships from the admin API.

create table if not exists public.admin_members (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'viewer')),
    is_active boolean not null default true,
    added_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists admin_members_active_role_idx
    on public.admin_members(is_active, role);

create table if not exists public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid references auth.users(id) on delete set null,
    action text not null,
    target_user_id uuid references auth.users(id) on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
    on public.admin_audit_log(created_at desc);

alter table public.admin_members enable row level security;
alter table public.admin_audit_log enable row level security;

create or replace function public.bootstrap_first_admin_owner(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    target_email text;
begin
    if exists (
        select 1
        from public.admin_members
        where role = 'owner' and is_active
    ) then
        raise exception using errcode = 'P0001', message = 'ACTIVE_OWNER_ALREADY_EXISTS';
    end if;

    select email
    into target_email
    from auth.users
    where id = p_user_id;

    if target_email is null then
        raise exception using errcode = 'P0001', message = 'ADMIN_USER_NOT_FOUND';
    end if;

    insert into public.admin_members (user_id, role, is_active, added_by)
    values (p_user_id, 'owner', true, null)
    on conflict (user_id) do update
    set role = 'owner',
        is_active = true,
        added_by = null,
        updated_at = now();

    insert into public.admin_audit_log (
        actor_user_id,
        action,
        target_user_id,
        metadata
    )
    values (
        p_user_id,
        'bootstrap_owner',
        p_user_id,
        jsonb_build_object('role', 'owner', 'email', target_email)
    );

    return jsonb_build_object(
        'userId', p_user_id,
        'email', target_email,
        'role', 'owner',
        'isActive', true
    );
end;
$$;

create or replace function public.list_admin_members()
returns table (
    user_id uuid,
    email text,
    role text,
    is_active boolean,
    added_by uuid,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
    select
        member.user_id,
        auth_user.email::text,
        member.role,
        member.is_active,
        member.added_by,
        member.created_at,
        member.updated_at
    from public.admin_members member
    join auth.users auth_user on auth_user.id = member.user_id
    order by
        case member.role
            when 'owner' then 1
            when 'admin' then 2
            else 3
        end,
        member.created_at;
$$;

create or replace function public.add_admin_member(
    p_actor_user_id uuid,
    p_email text,
    p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    target_user_id uuid;
    previous_role text;
    previous_active boolean;
begin
    if not exists (
        select 1
        from public.admin_members
        where user_id = p_actor_user_id
          and role = 'owner'
          and is_active
    ) then
        raise exception using errcode = 'P0001', message = 'OWNER_PERMISSION_REQUIRED';
    end if;

    if p_role not in ('owner', 'admin', 'viewer') then
        raise exception using errcode = 'P0001', message = 'INVALID_ADMIN_ROLE';
    end if;

    select id
    into target_user_id
    from auth.users
    where lower(email) = lower(trim(p_email))
    limit 1;

    if target_user_id is null then
        raise exception using errcode = 'P0001', message = 'ADMIN_USER_NOT_FOUND';
    end if;

    select role, is_active
    into previous_role, previous_active
    from public.admin_members
    where user_id = target_user_id;

    if previous_role = 'owner'
       and previous_active
       and p_role <> 'owner'
       and (
           select count(*)
           from public.admin_members
           where role = 'owner' and is_active
       ) <= 1 then
        raise exception using errcode = 'P0001', message = 'LAST_OWNER_PROTECTED';
    end if;

    insert into public.admin_members (
        user_id,
        role,
        is_active,
        added_by
    )
    values (
        target_user_id,
        p_role,
        true,
        p_actor_user_id
    )
    on conflict (user_id) do update
    set role = excluded.role,
        is_active = true,
        added_by = excluded.added_by,
        updated_at = now();

    insert into public.admin_audit_log (
        actor_user_id,
        action,
        target_user_id,
        metadata
    )
    values (
        p_actor_user_id,
        case
            when previous_role is null then 'admin_member_added'
            else 'admin_member_reactivated'
        end,
        target_user_id,
        jsonb_build_object(
            'email', lower(trim(p_email)),
            'previousRole', previous_role,
            'newRole', p_role
        )
    );

    return jsonb_build_object(
        'userId', target_user_id,
        'email', lower(trim(p_email)),
        'role', p_role,
        'isActive', true
    );
end;
$$;

create or replace function public.update_admin_member(
    p_actor_user_id uuid,
    p_target_user_id uuid,
    p_role text,
    p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    target public.admin_members;
    target_email text;
begin
    if not exists (
        select 1
        from public.admin_members
        where user_id = p_actor_user_id
          and role = 'owner'
          and is_active
    ) then
        raise exception using errcode = 'P0001', message = 'OWNER_PERMISSION_REQUIRED';
    end if;

    if p_role not in ('owner', 'admin', 'viewer') then
        raise exception using errcode = 'P0001', message = 'INVALID_ADMIN_ROLE';
    end if;

    select *
    into target
    from public.admin_members
    where user_id = p_target_user_id
    for update;

    if target.user_id is null then
        raise exception using errcode = 'P0001', message = 'ADMIN_MEMBER_NOT_FOUND';
    end if;

    if target.role = 'owner'
       and target.is_active
       and (p_role <> 'owner' or not p_is_active)
       and (
           select count(*)
           from public.admin_members
           where role = 'owner' and is_active
       ) <= 1 then
        raise exception using errcode = 'P0001', message = 'LAST_OWNER_PROTECTED';
    end if;

    select email
    into target_email
    from auth.users
    where id = p_target_user_id;

    update public.admin_members
    set role = p_role,
        is_active = p_is_active,
        updated_at = now()
    where user_id = p_target_user_id;

    insert into public.admin_audit_log (
        actor_user_id,
        action,
        target_user_id,
        metadata
    )
    values (
        p_actor_user_id,
        'admin_member_updated',
        p_target_user_id,
        jsonb_build_object(
            'email', target_email,
            'previousRole', target.role,
            'newRole', p_role,
            'previousActive', target.is_active,
            'newActive', p_is_active
        )
    );

    return jsonb_build_object(
        'userId', p_target_user_id,
        'email', target_email,
        'role', p_role,
        'isActive', p_is_active
    );
end;
$$;

create or replace function public.list_admin_audit_log(p_limit integer default 50)
returns table (
    id uuid,
    actor_user_id uuid,
    actor_email text,
    action text,
    target_user_id uuid,
    target_email text,
    metadata jsonb,
    created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
    select
        audit.id,
        audit.actor_user_id,
        actor.email::text,
        audit.action,
        audit.target_user_id,
        target.email::text,
        audit.metadata,
        audit.created_at
    from public.admin_audit_log audit
    left join auth.users actor on actor.id = audit.actor_user_id
    left join auth.users target on target.id = audit.target_user_id
    order by audit.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.bootstrap_first_admin_owner(uuid)
    from public, anon, authenticated;
revoke all on function public.list_admin_members()
    from public, anon, authenticated;
revoke all on function public.add_admin_member(uuid, text, text)
    from public, anon, authenticated;
revoke all on function public.update_admin_member(uuid, uuid, text, boolean)
    from public, anon, authenticated;
revoke all on function public.list_admin_audit_log(integer)
    from public, anon, authenticated;

grant execute on function public.bootstrap_first_admin_owner(uuid)
    to service_role;
grant execute on function public.list_admin_members()
    to service_role;
grant execute on function public.add_admin_member(uuid, text, text)
    to service_role;
grant execute on function public.update_admin_member(uuid, uuid, text, boolean)
    to service_role;
grant execute on function public.list_admin_audit_log(integer)
    to service_role;
