-- supabase/migrations/031_reservations.sql

create type reservation_status as enum (
  'pendente', 'confirmada', 'cancelada', 'no_show', 'finalizada'
);

create type reservation_origem as enum (
  'whatsapp', 'telefone', 'email', 'tagme', 'presencial', 'instagram'
);

create table reservations (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid not null references units(id) on delete cascade,
  data             date not null,
  hora             time not null,
  pax              integer not null check (pax > 0),
  status           reservation_status not null default 'pendente',
  origem           reservation_origem not null default 'whatsapp',
  cliente_nome     text not null,
  cliente_telefone text,
  cliente_email    text,
  mesa             text,
  observacoes      text,
  confirmado_por   uuid references auth.users(id),
  confirmado_em    timestamptz,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index reservations_unit_data_idx on reservations(unit_id, data);

alter table reservations enable row level security;

create policy "unit members can select reservations"
  on reservations for select
  using (maza_has_role_for_unit(unit_id));

create policy "unit members can insert reservations"
  on reservations for insert
  with check (maza_has_role_for_unit(unit_id));

create policy "unit members can update reservations"
  on reservations for update
  using (maza_has_role_for_unit(unit_id))
  with check (maza_has_role_for_unit(unit_id));
