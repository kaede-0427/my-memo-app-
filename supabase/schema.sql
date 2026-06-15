-- プロジェクトテーブル
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- メモテーブル（プロジェクトに1対1）
create table memos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz default now()
);

-- タスクテーブル
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'on_hold', 'review', 'done')),
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  due_date date,
  created_at timestamptz default now()
);

-- updated_at を自動更新するトリガー
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger memos_updated_at
  before update on memos
  for each row execute function update_updated_at();
