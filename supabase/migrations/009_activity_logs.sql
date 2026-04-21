-- ============================================================
-- Migration 009: Activity Logs
-- ============================================================

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  actor_role text check (actor_role in ('admin', 'staff', 'superadmin')),
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists activity_logs_created_at_idx on activity_logs (created_at desc);
create index if not exists activity_logs_actor_id_idx on activity_logs (actor_id);
create index if not exists activity_logs_entity_idx on activity_logs (entity_type, entity_id);

alter table activity_logs enable row level security;

create or replace function is_admin_or_superadmin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'superadmin')
  );
$$ language sql security definer stable;

create policy "activity_logs: admin read"
  on activity_logs for select
  using (is_admin_or_superadmin());
