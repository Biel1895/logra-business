begin;

create table public.caixa_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  sale_date date not null,
  kind text not null default 'PRODUTO' check (kind in ('PRODUTO', 'SERVICO')),
  product text not null check (length(btrim(product)) between 1 and 1500),
  cash numeric(14,2) not null default 0 check (cash >= 0),
  pix numeric(14,2) not null default 0 check (pix >= 0),
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  installments integer not null default 0 check (installments >= 0 and (installments = 0 or credit > 0)),
  trade_in numeric(14,2) not null default 0 check (trade_in >= 0),
  trade_in_details text not null default '',
  payjoy numeric(14,2) not null default 0 check (payjoy >= 0),
  other_finance numeric(14,2) not null default 0 check (other_finance >= 0),
  note text not null default '',
  service_parts text not null default '',
  total numeric(14,2) not null check (total > 0 and total = cash + pix + debit + credit + trade_in + payjoy + other_finance)
);

create table public.caixa_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expense_date date not null,
  description text not null check (length(btrim(description)) between 1 and 1500),
  payment_method text not null check (payment_method in ('Dinheiro', 'PIX', 'Débito', 'Crédito', 'Outro')),
  amount numeric(14,2) not null check (amount > 0),
  note text not null default ''
);

create table public.caixa_cash_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  movement_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  note text not null default ''
);

create table public.caixa_day_closings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  closing_date date not null,
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  counted_cash numeric(14,2) not null default 0 check (counted_cash >= 0),
  unique (user_id, closing_date)
);

create table public.caixa_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb
);

create index on public.caixa_sales (user_id, sale_date, created_at, id);
create index on public.caixa_expenses (user_id, expense_date, created_at, id);
create index on public.caixa_cash_movements (user_id, movement_date, created_at, id);
create index on public.caixa_audit_logs (user_id, created_at desc);

create schema if not exists caixa_private;
revoke all on schema caixa_private from public, anon, authenticated;

create function caixa_private.log_cash_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
  after_row jsonb;
  owner_id uuid;
begin
  if tg_op <> 'INSERT' then
    before_row := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    after_row := to_jsonb(new);
  end if;
  if tg_op = 'UPDATE' and before_row = after_row then
    return null;
  end if;
  owner_id := coalesce((after_row->>'user_id')::uuid, (before_row->>'user_id')::uuid);
  -- During account deletion, the cascade also removes that account's history.
  if exists (select 1 from auth.users where id = owner_id) then
    insert into public.caixa_audit_logs (user_id, table_name, action, old_data, new_data)
    values (owner_id, substr(tg_table_name, 7), tg_op, before_row, after_row);
  end if;
  return null;
end;
$$;
revoke all on function caixa_private.log_cash_change() from public, anon, authenticated;

do $$
declare
  name text;
begin
  foreach name in array array['caixa_sales', 'caixa_expenses', 'caixa_cash_movements', 'caixa_day_closings'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('revoke all on public.%I from public, anon, authenticated', name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', name);
    execute format(
      'create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      name
    );
    execute format(
      'create trigger log_change after insert or update or delete on public.%I for each row execute function caixa_private.log_cash_change()',
      name
    );
  end loop;
end;
$$;

alter table public.caixa_audit_logs enable row level security;
revoke all on public.caixa_audit_logs from public, anon, authenticated;
grant select on public.caixa_audit_logs to authenticated;
create policy read_own_history on public.caixa_audit_logs
  for select to authenticated using ((select auth.uid()) = user_id);

commit;
