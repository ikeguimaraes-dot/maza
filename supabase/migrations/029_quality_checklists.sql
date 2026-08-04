-- supabase/migrations/029_quality_checklists.sql

create type checklist_turno as enum ('abertura', 'almoco', 'jantar', 'fechamento');
create type checklist_area  as enum ('cozinha', 'bar', 'salao', 'higiene', 'geral');

create table quality_checklists (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  nome        text not null,
  area        checklist_area not null default 'geral',
  turno       checklist_turno not null default 'abertura',
  items       jsonb not null default '[]'::jsonb,
  -- items é array de { id: uuid, texto: string, obrigatorio: boolean }
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table checklist_records (
  id              uuid primary key default gen_random_uuid(),
  checklist_id    uuid not null references quality_checklists(id) on delete cascade,
  unit_id         uuid not null references units(id) on delete cascade,
  data            date not null default current_date,
  turno           checklist_turno not null,
  responsavel_id  uuid references auth.users(id),
  respostas       jsonb not null default '{}'::jsonb,
  -- respostas é { [item_id]: boolean }
  score_pct       integer,
  observacoes     text,
  created_at      timestamptz not null default now()
);

create index quality_checklists_unit_idx on quality_checklists(unit_id);
create index checklist_records_unit_data_idx on checklist_records(unit_id, data);
create index checklist_records_checklist_idx on checklist_records(checklist_id);

alter table quality_checklists enable row level security;
alter table checklist_records  enable row level security;

create policy "unit members can manage checklists"
  on quality_checklists for all
  using (maza_has_role_for_unit(unit_id))
  with check (maza_has_role_for_unit(unit_id));

create policy "unit members can select records"
  on checklist_records for select using (maza_has_role_for_unit(unit_id));
create policy "unit members can insert records"
  on checklist_records for insert with check (maza_has_role_for_unit(unit_id));
