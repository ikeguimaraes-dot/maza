-- supabase/migrations/030_restaurant_tables.sql

create type table_status as enum ('livre', 'ocupada', 'reservada', 'bloqueada');
create type table_area   as enum ('salao', 'varanda', 'bar', 'vip', 'externa');

create table restaurant_tables (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  numero     text not null,          -- ex: "1", "A3", "VIP-2"
  capacidade integer not null default 4,
  area       table_area not null default 'salao',
  status     table_status not null default 'livre',
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unit_id, numero)
);

create index restaurant_tables_unit_idx on restaurant_tables(unit_id);

alter table restaurant_tables enable row level security;

create policy "unit members can select tables"
  on restaurant_tables for select using (maza_has_role_for_unit(unit_id));
create policy "unit members can manage tables"
  on restaurant_tables for all
  using (maza_has_role_for_unit(unit_id))
  with check (maza_has_role_for_unit(unit_id));
