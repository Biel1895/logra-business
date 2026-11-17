begin;

alter table public.caixa_sales
  drop constraint if exists caixa_sales_product_check,
  drop constraint if exists caixa_sales_total_check,
  add constraint caixa_sales_product_check check (
    length(btrim(product)) <= 1500
    and (
      product ~ '[^[:space:]]'
      or note ~ '[^[:space:]]'
      or (kind = 'SERVICO' and service_parts ~ '[^[:space:]]')
    )
  ),
  add constraint caixa_sales_total_check check (
    total = cash + pix + debit + credit + trade_in + payjoy + other_finance
    and total >= 0 and total <> 'NaN'::numeric
  );

commit;
