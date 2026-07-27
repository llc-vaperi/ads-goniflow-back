-- Provider-neutral purchase orders.
-- Prices and credit quantities are snapshotted when an order is created.
-- Only a verified server-side payment webhook may call fulfill_credit_purchase.

create table if not exists public.credit_purchases (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    product_id text not null,
    quantity integer not null check (quantity between 1 and 100),
    amount_gel numeric(12, 2) not null check (amount_gel > 0),
    credits integer not null check (credits > 0),
    provider text,
    provider_order_id text,
    checkout_url text,
    status text not null default 'created'
        check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
    idempotency_key text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    paid_at timestamptz,
    unique (user_id, idempotency_key)
);

create unique index if not exists credit_purchases_provider_order_idx
    on public.credit_purchases(provider, provider_order_id)
    where provider is not null and provider_order_id is not null;

create index if not exists credit_purchases_user_created_idx
    on public.credit_purchases(user_id, created_at desc);

alter table public.credit_purchases enable row level security;

drop policy if exists "credit_purchases_select_own" on public.credit_purchases;
create policy "credit_purchases_select_own"
    on public.credit_purchases
    for select
    using (auth.uid() = user_id);

create or replace function public.fulfill_credit_purchase(
    p_purchase_id uuid,
    p_provider text,
    p_provider_order_id text,
    p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    purchase public.credit_purchases;
    wallet public.credit_wallets;
    new_paid_balance integer;
begin
    select *
    into purchase
    from public.credit_purchases
    where id = p_purchase_id
    for update;

    if purchase.id is null then
        raise exception using errcode = 'P0001', message = 'CREDIT_PURCHASE_NOT_FOUND';
    end if;

    if purchase.status = 'paid' then
        return jsonb_build_object(
            'purchaseId', purchase.id,
            'status', purchase.status,
            'credited', false
        );
    end if;

    if purchase.status not in ('created', 'pending') then
        raise exception using errcode = 'P0001', message = 'CREDIT_PURCHASE_NOT_PAYABLE';
    end if;

    perform public.ensure_credit_wallet(purchase.user_id);

    select *
    into wallet
    from public.credit_wallets
    where user_id = purchase.user_id
    for update;

    new_paid_balance := wallet.paid_balance + purchase.credits;

    update public.credit_wallets
    set paid_balance = new_paid_balance,
        updated_at = now()
    where user_id = purchase.user_id;

    update public.credit_purchases
    set provider = p_provider,
        provider_order_id = p_provider_order_id,
        status = 'paid',
        paid_at = now(),
        updated_at = now(),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
    where id = purchase.id;

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
        purchase.user_id,
        purchase.credits,
        'paid',
        'credit_purchase',
        new_paid_balance,
        'purchase:' || purchase.id::text,
        purchase.id::text,
        jsonb_build_object(
            'productId', purchase.product_id,
            'quantity', purchase.quantity,
            'amountGel', purchase.amount_gel,
            'provider', p_provider,
            'providerOrderId', p_provider_order_id
        )
    );

    return jsonb_build_object(
        'purchaseId', purchase.id,
        'status', 'paid',
        'credited', true,
        'credits', purchase.credits,
        'paidBalance', new_paid_balance,
        'totalBalance', wallet.promo_balance + new_paid_balance
    );
end;
$$;

revoke all on function public.fulfill_credit_purchase(uuid, text, text, jsonb)
    from public, anon, authenticated;
grant execute on function public.fulfill_credit_purchase(uuid, text, text, jsonb)
    to service_role;
