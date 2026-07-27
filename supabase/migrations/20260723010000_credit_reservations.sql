-- Atomic credit reservation lifecycle for paid AI operations.
-- Credits are reserved before an external provider call, consumed on success,
-- and restored to the same buckets when the operation fails.

create table if not exists public.credit_reservations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    amount integer not null check (amount > 0),
    promo_amount integer not null default 0 check (promo_amount >= 0),
    paid_amount integer not null default 0 check (paid_amount >= 0),
    operation text not null,
    status text not null default 'reserved'
        check (status in ('reserved', 'consumed', 'refunded')),
    idempotency_key text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    settled_at timestamptz,
    unique (user_id, idempotency_key),
    check (promo_amount + paid_amount = amount)
);

create index if not exists credit_reservations_user_created_idx
    on public.credit_reservations(user_id, created_at desc);

alter table public.credit_reservations enable row level security;

drop policy if exists "credit_reservations_select_own" on public.credit_reservations;
create policy "credit_reservations_select_own"
    on public.credit_reservations
    for select
    using (auth.uid() = user_id);

create or replace function public.reserve_credits(
    p_user_id uuid,
    p_amount integer,
    p_operation text,
    p_idempotency_key text,
    p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    wallet public.credit_wallets;
    reservation public.credit_reservations;
    promo_used integer;
    paid_used integer;
    new_promo_balance integer;
    new_paid_balance integer;
begin
    if p_amount <= 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_CREDIT_AMOUNT';
    end if;

    perform public.ensure_credit_wallet(p_user_id);

    select *
    into wallet
    from public.credit_wallets
    where user_id = p_user_id
    for update;

    -- The wallet lock serializes retries for the same user.
    select *
    into reservation
    from public.credit_reservations
    where user_id = p_user_id
      and idempotency_key = p_idempotency_key;

    if reservation.id is not null then
        return jsonb_build_object(
            'reservationId', reservation.id,
            'status', reservation.status,
            'cost', reservation.amount,
            'promoDebited', reservation.promo_amount,
            'paidDebited', reservation.paid_amount,
            'promoBalance', wallet.promo_balance,
            'paidBalance', wallet.paid_balance,
            'totalBalance', wallet.promo_balance + wallet.paid_balance
        );
    end if;

    if wallet.promo_balance + wallet.paid_balance < p_amount then
        raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
    end if;

    promo_used := least(wallet.promo_balance, p_amount);
    paid_used := p_amount - promo_used;
    new_promo_balance := wallet.promo_balance - promo_used;
    new_paid_balance := wallet.paid_balance - paid_used;

    update public.credit_wallets
    set promo_balance = new_promo_balance,
        paid_balance = new_paid_balance,
        updated_at = now()
    where user_id = p_user_id;

    insert into public.credit_reservations (
        user_id,
        amount,
        promo_amount,
        paid_amount,
        operation,
        idempotency_key,
        metadata
    )
    values (
        p_user_id,
        p_amount,
        promo_used,
        paid_used,
        p_operation,
        p_idempotency_key,
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into reservation;

    if promo_used > 0 then
        insert into public.credit_ledger (
            user_id,
            amount,
            bucket,
            entry_type,
            balance_after,
            idempotency_key,
            reference_id,
            metadata
        )
        values (
            p_user_id,
            -promo_used,
            'promo',
            'generation_reserve',
            new_promo_balance,
            'reserve:' || reservation.id::text || ':promo',
            reservation.id::text,
            jsonb_build_object('operation', p_operation)
        );
    end if;

    if paid_used > 0 then
        insert into public.credit_ledger (
            user_id,
            amount,
            bucket,
            entry_type,
            balance_after,
            idempotency_key,
            reference_id,
            metadata
        )
        values (
            p_user_id,
            -paid_used,
            'paid',
            'generation_reserve',
            new_paid_balance,
            'reserve:' || reservation.id::text || ':paid',
            reservation.id::text,
            jsonb_build_object('operation', p_operation)
        );
    end if;

    return jsonb_build_object(
        'reservationId', reservation.id,
        'status', reservation.status,
        'cost', reservation.amount,
        'promoDebited', reservation.promo_amount,
        'paidDebited', reservation.paid_amount,
        'promoBalance', new_promo_balance,
        'paidBalance', new_paid_balance,
        'totalBalance', new_promo_balance + new_paid_balance
    );
end;
$$;

create or replace function public.consume_credit_reservation(
    p_user_id uuid,
    p_reservation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reservation public.credit_reservations;
begin
    select *
    into reservation
    from public.credit_reservations
    where id = p_reservation_id
      and user_id = p_user_id
    for update;

    if reservation.id is null then
        raise exception using errcode = 'P0001', message = 'CREDIT_RESERVATION_NOT_FOUND';
    end if;

    if reservation.status = 'refunded' then
        raise exception using errcode = 'P0001', message = 'CREDIT_RESERVATION_ALREADY_REFUNDED';
    end if;

    if reservation.status = 'reserved' then
        update public.credit_reservations
        set status = 'consumed',
            settled_at = now()
        where id = reservation.id;
        reservation.status := 'consumed';
    end if;

    return jsonb_build_object(
        'reservationId', reservation.id,
        'status', reservation.status,
        'cost', reservation.amount
    );
end;
$$;

create or replace function public.refund_credit_reservation(
    p_user_id uuid,
    p_reservation_id uuid,
    p_reason text default 'generation_failed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reservation public.credit_reservations;
    wallet public.credit_wallets;
    new_promo_balance integer;
    new_paid_balance integer;
begin
    select *
    into reservation
    from public.credit_reservations
    where id = p_reservation_id
      and user_id = p_user_id
    for update;

    if reservation.id is null then
        raise exception using errcode = 'P0001', message = 'CREDIT_RESERVATION_NOT_FOUND';
    end if;

    if reservation.status = 'consumed' then
        return jsonb_build_object(
            'reservationId', reservation.id,
            'status', reservation.status,
            'refunded', false
        );
    end if;

    select *
    into wallet
    from public.credit_wallets
    where user_id = p_user_id
    for update;

    if reservation.status = 'refunded' then
        return jsonb_build_object(
            'reservationId', reservation.id,
            'status', reservation.status,
            'refunded', true,
            'promoBalance', wallet.promo_balance,
            'paidBalance', wallet.paid_balance,
            'totalBalance', wallet.promo_balance + wallet.paid_balance
        );
    end if;

    new_promo_balance := wallet.promo_balance + reservation.promo_amount;
    new_paid_balance := wallet.paid_balance + reservation.paid_amount;

    update public.credit_wallets
    set promo_balance = new_promo_balance,
        paid_balance = new_paid_balance,
        updated_at = now()
    where user_id = p_user_id;

    update public.credit_reservations
    set status = 'refunded',
        settled_at = now(),
        metadata = metadata || jsonb_build_object('refundReason', p_reason)
    where id = reservation.id;

    if reservation.promo_amount > 0 then
        insert into public.credit_ledger (
            user_id,
            amount,
            bucket,
            entry_type,
            balance_after,
            idempotency_key,
            reference_id,
            metadata
        )
        values (
            p_user_id,
            reservation.promo_amount,
            'promo',
            'generation_refund',
            new_promo_balance,
            'refund:' || reservation.id::text || ':promo',
            reservation.id::text,
            jsonb_build_object('reason', p_reason)
        );
    end if;

    if reservation.paid_amount > 0 then
        insert into public.credit_ledger (
            user_id,
            amount,
            bucket,
            entry_type,
            balance_after,
            idempotency_key,
            reference_id,
            metadata
        )
        values (
            p_user_id,
            reservation.paid_amount,
            'paid',
            'generation_refund',
            new_paid_balance,
            'refund:' || reservation.id::text || ':paid',
            reservation.id::text,
            jsonb_build_object('reason', p_reason)
        );
    end if;

    return jsonb_build_object(
        'reservationId', reservation.id,
        'status', 'refunded',
        'refunded', true,
        'promoBalance', new_promo_balance,
        'paidBalance', new_paid_balance,
        'totalBalance', new_promo_balance + new_paid_balance
    );
end;
$$;

revoke all on function public.reserve_credits(uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.consume_credit_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refund_credit_reservation(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.reserve_credits(uuid, integer, text, text, jsonb) to service_role;
grant execute on function public.consume_credit_reservation(uuid, uuid) to service_role;
grant execute on function public.refund_credit_reservation(uuid, uuid, text) to service_role;

