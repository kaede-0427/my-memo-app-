-- Add position to memos
alter table memos add column if not exists position integer default 0;

with ranked as (
  select id, row_number() over (partition by project_id order by updated_at) - 1 as rn from memos
)
update memos m set position = r.rn from ranked r where m.id = r.id;

-- Create mind_maps table
create table if not exists mind_maps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid unique references projects(id) on delete cascade not null,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  updated_at timestamp with time zone not null default now()
);
