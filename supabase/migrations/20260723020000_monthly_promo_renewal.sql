-- Lazily renew monthly promo credits whenever a wallet is read or charged.
-- This avoids a pg_cron dependency: ensure_credit_wallet is already called by
-- balance/history reads and every generation reservation.

create or replace function public.ensure_credit_wallet(p_user_id uuid)
returns public.credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
    created_wallet public.credit_wallets;
    result_wallet public.credit_wallets;
    current_cycle date := date_trunc('month', current_date)::date;
    promo_delta integer;
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
    where user_id = p_user_id
    for update;

    if result_wallet.promo_cycle_start < current_cycle then
        promo_delta := 9 - result_wallet.promo_balance;

        update public.credit_wallets
        set promo_balance = 9,
            promo_cycle_start = current_cycle,
            updated_at = now()
        where user_id = p_user_id
        returning * into result_wallet;

        if promo_delta <> 0 then
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
                promo_delta,
                'promo',
                'monthly_promo_reset',
                result_wallet.promo_balance,
                'promo-cycle:' || p_user_id::text || ':' || current_cycle::text,
                jsonb_build_object('cycle_start', current_cycle)
            );
        end if;
    end if;

    return result_wallet;
end;
$$;

revoke all on function public.ensure_credit_wallet(uuid) from public;
revoke all on function public.ensure_credit_wallet(uuid) from anon;
revoke all on function public.ensure_credit_wallet(uuid) from authenticated;
grant execute on function public.ensure_credit_wallet(uuid) to service_role;

