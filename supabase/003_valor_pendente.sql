begin;

alter table public.caixa_sales
  add column pending_amount numeric(14,2) not null default 0
    check (pending_amount >= 0 and pending_amount <> 'NaN'::numeric),
  drop constraint caixa_sales_total_check,
  add constraint caixa_sales_total_check check (
    total = cash + pix + debit + credit + trade_in + payjoy + other_finance
    and (total > 0 or (total = 0 and (kind = 'SERVICO' or pending_amount > 0)))
  );

commit;
