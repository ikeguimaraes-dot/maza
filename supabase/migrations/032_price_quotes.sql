-- supabase/migrations/032_price_quotes.sql

create type quote_status as enum ('rascunho', 'enviada', 'recebida', 'aprovada', 'cancelada');

create table price_quotes (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  periodo     date not null,
  status      quote_status not null default 'rascunho',
  titulo      text,
  observacoes text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table price_quote_items (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references price_quotes(id) on delete cascade,
  descricao       text not null,
  unidade         text not null default 'kg',
  quantidade      numeric(10,3) not null,
  preco_unitario  numeric(10,4),
  total           numeric(12,2) generated always as (
    case when preco_unitario is not null then quantidade * preco_unitario else null end
  ) stored,
  observacoes     text,
  created_at      timestamptz not null default now()
);

create index price_quotes_unit_idx on price_quotes(unit_id, periodo);
create index price_quote_items_quote_idx on price_quote_items(quote_id);

alter table price_quotes enable row level security;
alter table price_quote_items enable row level security;

create policy "unit members can select quotes"
  on price_quotes for select using (maza_has_role_for_unit(unit_id));
create policy "unit members can insert quotes"
  on price_quotes for insert with check (maza_has_role_for_unit(unit_id));
create policy "unit members can update quotes"
  on price_quotes for update
  using (maza_has_role_for_unit(unit_id))
  with check (maza_has_role_for_unit(unit_id));

create policy "unit members can select quote items"
  on price_quote_items for select
  using (exists (select 1 from price_quotes q where q.id = quote_id and maza_has_role_for_unit(q.unit_id)));
create policy "unit members can insert quote items"
  on price_quote_items for insert
  with check (exists (select 1 from price_quotes q where q.id = quote_id and maza_has_role_for_unit(q.unit_id)));
create policy "unit members can update quote items"
  on price_quote_items for update
  using (exists (select 1 from price_quotes q where q.id = quote_id and maza_has_role_for_unit(q.unit_id)));
create policy "unit members can delete quote items"
  on price_quote_items for delete
  using (exists (select 1 from price_quotes q where q.id = quote_id and maza_has_role_for_unit(q.unit_id)));
