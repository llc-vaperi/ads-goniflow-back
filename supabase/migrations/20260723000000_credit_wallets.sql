-- Credit wallet foundation.
--
-- Promo and paid credits are intentionally stored separately:
-- promo credits may be renewed/expired, while purchased credits never expire.
-- All balance changes must also be recorded in credit_ledger.

create table if not exists public.credit_wallets (
    user_id uuid primary key references auth.users(id) on delete cascade,
    promo_balance integer not null default 9 check (promo_balance >= 0),
    paid_balance integer not null default 0 check (paid_balance >= 0),
    promo_cycle_start date not null default date_trunc('month', current_date)::date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    amount integer not null check (amount <> 0),
    bucket text not null check (bucket in ('promo', 'paid')),
    entry_type text not null,
    balance_after integer not null check (balance_after >= 0),
    idempotency_key text,
    reference_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_created_idx
    on public.credit_ledger(user_id, created_at desc);

create unique index if not exists credit_ledger_idempotency_idx
    on public.credit_ledger(idempotency_key)
    where idempotency_key is not null;

alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "credit_wallets_select_own" on public.credit_wallets;
create policy "credit_wallets_select_own"
    on public.credit_wallets
    for select
    using (auth.uid() = user_id);

drop policy if exists "credit_ledger_select_own" on public.credit_ledger;
create policy "credit_ledger_select_own"
    on public.credit_ledger
    for select
    using (auth.uid() = user_id);

-- Creates a wallet exactly once and records its initial promo grant.
-- Mutating permissions remain server-only; users only receive SELECT policies.
create or replace function public.ensure_credit_wallet(p_user_id uuid)
returns public.credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
    created_wallet public.credit_wallets;
    result_wallet public.credit_wallets;
begin
    insert into public.credit_wallets (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing
    returning * into created_wallet;

    if created_wallet.user_id is not null then
        insert into public.credit_ledger (
            user_id,
            amount,
            bucket,
            entry_type,
            balance_after,
            idempotency_key,
            metadata
        )
        values (
            p_user_id,
            created_wallet.promo_balance,
            'promo',
            'initial_promo_grant',
            created_wallet.promo_balance,
            'initial-promo:' || p_user_id::text,
            jsonb_build_object('cycle_start', created_wallet.promo_cycle_start)
        );
    end if;

    select *
    into result_wallet
    from public.credit_wallets
    where user_id = p_user_id;

    return result_wallet;
end;
$$;

revoke all on function public.ensure_credit_wallet(uuid) from public;
revoke all on function public.ensure_credit_wallet(uuid) from anon;
revoke all on function public.ensure_credit_wallet(uuid) from authenticated;
grant execute on function public.ensure_credit_wallet(uuid) to service_role;

-- Existing accounts receive their initial wallet when this migration is applied.
do $$
declare
    existing_user record;
begin
    for existing_user in select id from auth.users loop
        perform public.ensure_credit_wallet(existing_user.id);
    end loop;
end;
$$;

-- Future accounts receive a wallet immediately after Supabase Auth creates them.
create or replace function public.handle_new_user_credit_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.ensure_credit_wallet(new.id);
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_credit_wallet on auth.users;
create trigger on_auth_user_created_credit_wallet
    after insert on auth.users
    for each row execute function public.handle_new_user_credit_wallet();

