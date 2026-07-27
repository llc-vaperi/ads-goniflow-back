-- Aggregated per-user credit usage analytics.
-- Only consumed reservations count as spend; refunded operations are reported
-- separately and never inflate the user's usage totals.

create or replace function public.get_credit_usage_summary(
    p_user_id uuid,
    p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    safe_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
    period_start timestamptz;
    result jsonb;
begin
    period_start := now() - make_interval(days => safe_days);

    with period_reservations as (
        select
            amount,
            promo_amount,
            paid_amount,
            operation,
            status,
            coalesce(metadata->>'mode', 'standard') as mode,
            coalesce(nullif(metadata->>'platform', ''), 'unknown') as platform
        from public.credit_reservations
        where user_id = p_user_id
          and created_at >= period_start
    ),
    platform_counts as (
        select platform, count(*)::integer as operation_count
        from period_reservations
        where status = 'consumed'
        group by platform
    )
    select jsonb_build_object(
        'periodDays', safe_days,
        'periodStart', period_start,
        'creditsSpent', coalesce(sum(amount) filter (where status = 'consumed'), 0),
        'promoCreditsSpent', coalesce(sum(promo_amount) filter (where status = 'consumed'), 0),
        'paidCreditsSpent', coalesce(sum(paid_amount) filter (where status = 'consumed'), 0),
        'operations', count(*) filter (where status = 'consumed'),
        'textOperations', count(*) filter (
            where status = 'consumed' and operation = 'generate_text'
        ),
        'imageOperations', count(*) filter (
            where status = 'consumed' and operation = 'generate_image'
        ),
        'standardOperations', count(*) filter (
            where status = 'consumed' and mode = 'standard'
        ),
        'premiumOperations', count(*) filter (
            where status = 'consumed' and mode = 'premium'
        ),
        'refundedOperations', count(*) filter (where status = 'refunded'),
        'platforms', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'platform', platform,
                    'operations', operation_count
                )
                order by operation_count desc, platform
            )
            from platform_counts
        ), '[]'::jsonb),
        'allTimeCreditsSpent', (
            select coalesce(sum(amount), 0)
            from public.credit_reservations
            where user_id = p_user_id
              and status = 'consumed'
        ),
        'allTimeOperations', (
            select count(*)
            from public.credit_reservations
            where user_id = p_user_id
              and status = 'consumed'
        )
    )
    into result
    from period_reservations;

    return result;
end;
$$;

revoke all on function public.get_credit_usage_summary(uuid, integer)
    from public, anon, authenticated;
grant execute on function public.get_credit_usage_summary(uuid, integer)
    to service_role;
