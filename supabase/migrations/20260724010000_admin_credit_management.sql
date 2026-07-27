-- Read-only user directory for all active admin roles and atomic manual credit
-- adjustments for owners/admins. Every balance change is written to both the
-- user's credit ledger and the admin audit log.

create or replace function public.list_admin_credit_users(
    p_actor_user_id uuid,
    p_search text default '',
    p_limit integer default 50,
    p_offset integer default 0
)
returns table (
    user_id uuid,
    email text,
    promo_balance integer,
    paid_balance integer,
    total_balance integer,
    registered_at timestamptz,
    total_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
    safe_offset integer := greatest(coalesce(p_offset, 0), 0);
    normalized_search text := lower(trim(coalesce(p_search, '')));
begin
    if not exists (
        select 1
        from public.admin_members
        where user_id = p_actor_user_id
          and is_active
          and role in ('owner', 'admin', 'viewer')
    ) then
        raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_REQUIRED';
    end if;

    return query
    select
        auth_user.id,
        auth_user.email::text,
        coalesce(wallet.promo_balance, 0),
        coalesce(wallet.paid_balance, 0),
        coalesce(wallet.promo_balance, 0) + coalesce(wallet.paid_balance, 0),
        auth_user.created_at,
        count(*) over()
    from auth.users auth_user
    left join public.credit_wallets wallet on wallet.user_id = auth_user.id
    where normalized_search = ''
       or lower(coalesce(auth_user.email, '')) like '%' || normalized_search || '%'
    order by auth_user.created_at desc
    limit safe_limit
    offset safe_offset;
end;
$$;

create or replace function public.adjust_user_credits(
    p_actor_user_id uuid,
    p_target_user_id uuid,
    p_bucket text,
    p_amount integer,
    p_reason text,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    actor_role text;
    target_email text;
    wallet public.credit_wallets;
    previous_balance integer;
    new_balance integer;
    existing_entry public.credit_ledger;
    ledger_key text := 'admin-adjustment:' || trim(p_idempotency_key);
begin
    select role
    into actor_role
    from public.admin_members
    where user_id = p_actor_user_id
      and is_active;

    if actor_role is null or actor_role not in ('owner', 'admin') then
        raise exception using errcode = 'P0001', message = 'ADMIN_WRITE_PERMISSION_REQUIRED';
    end if;

    if p_bucket not in ('promo', 'paid') then
        raise exception using errcode = 'P0001', message = 'INVALID_CREDIT_BUCKET';
    end if;

    if p_amount = 0 or abs(p_amount) > 100000 then
        raise exception using errcode = 'P0001', message = 'INVALID_CREDIT_ADJUSTMENT';
    end if;

    if length(trim(coalesce(p_reason, ''))) < 3
       or length(trim(p_reason)) > 300 then
        raise exception using errcode = 'P0001', message = 'INVALID_ADJUSTMENT_REASON';
    end if;

    if trim(coalesce(p_idempotency_key, '')) !~ '^[A-Za-z0-9._:-]{1,128}$' then
        raise exception using errcode = 'P0001', message = 'INVALID_IDEMPOTENCY_KEY';
    end if;

    select *
    into existing_entry
    from public.credit_ledger
    where idempotency_key = ledger_key;

    if existing_entry.id is not null then
        if existing_entry.user_id <> p_target_user_id
           or existing_entry.bucket <> p_bucket
           or existing_entry.amount <> p_amount then
            raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_CONFLICT';
        end if;

        return jsonb_build_object(
            'userId', existing_entry.user_id,
            'bucket', existing_entry.bucket,
            'amount', existing_entry.amount,
            'balanceAfter', existing_entry.balance_after,
            'alreadyApplied', true
        );
    end if;

    select email
    into target_email
    from auth.users
    where id = p_target_user_id;

    if target_email is null then
        raise exception using errcode = 'P0001', message = 'ADMIN_USER_NOT_FOUND';
    end if;

    perform public.ensure_credit_wallet(p_target_user_id);

    select *
    into wallet
    from public.credit_wallets
    where user_id = p_target_user_id
    for update;

    previous_balance := case
        when p_bucket = 'promo' then wallet.promo_balance
        else wallet.paid_balance
    end;
    new_balance := previous_balance + p_amount;

    if new_balance < 0 then
        raise exception using errcode = 'P0001', message = 'CREDIT_BALANCE_CANNOT_BE_NEGATIVE';
    end if;

    if p_bucket = 'promo' then
        update public.credit_wallets
        set promo_balance = new_balance,
            updated_at = now()
        where user_id = p_target_user_id;
    else
        update public.credit_wallets
        set paid_balance = new_balance,
            updated_at = now()
        where user_id = p_target_user_id;
    end if;

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
        p_target_user_id,
        p_amount,
        p_bucket,
        'admin_adjustment',
        new_balance,
        ledger_key,
        p_actor_user_id::text,
        jsonb_build_object(
            'actorUserId', p_actor_user_id,
            'actorRole', actor_role,
            'reason', trim(p_reason),
            'previousBalance', previous_balance
        )
    );

    insert into public.admin_audit_log (
        actor_user_id,
        action,
        target_user_id,
        metadata
    )
    values (
        p_actor_user_id,
        'credit_adjustment',
        p_target_user_id,
        jsonb_build_object(
            'targetEmail', target_email,
            'bucket', p_bucket,
            'amount', p_amount,
            'reason', trim(p_reason),
            'previousBalance', previous_balance,
            'newBalance', new_balance,
            'idempotencyKey', p_idempotency_key
        )
    );

    return jsonb_build_object(
        'userId', p_target_user_id,
        'email', target_email,
        'bucket', p_bucket,
        'amount', p_amount,
        'balanceBefore', previous_balance,
        'balanceAfter', new_balance,
        'promoBalance', case
            when p_bucket = 'promo' then new_balance
            else wallet.promo_balance
        end,
        'paidBalance', case
            when p_bucket = 'paid' then new_balance
            else wallet.paid_balance
        end,
        'totalBalance',
            case when p_bucket = 'promo' then new_balance else wallet.promo_balance end
            + case when p_bucket = 'paid' then new_balance else wallet.paid_balance end,
        'alreadyApplied', false
    );
end;
$$;

revoke all on function public.list_admin_credit_users(uuid, text, integer, integer)
    from public, anon, authenticated;
revoke all on function public.adjust_user_credits(uuid, uuid, text, integer, text, text)
    from public, anon, authenticated;

grant execute on function public.list_admin_credit_users(uuid, text, integer, integer)
    to service_role;
grant execute on function public.adjust_user_credits(uuid, uuid, text, integer, text, text)
    to service_role;
