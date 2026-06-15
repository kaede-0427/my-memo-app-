-- 並び順カラムを追加
alter table projects add column if not exists position integer default 0;
alter table tasks add column if not exists position integer default 0;

-- 既存データに順番を設定
with ranked as (
  select id, row_number() over (order by created_at) - 1 as rn from projects
)
update projects p set position = r.rn from ranked r where p.id = r.id;

with ranked as (
  select id, row_number() over (partition by project_id order by created_at) - 1 as rn from tasks
)
update tasks t set position = r.rn from ranked r where t.id = r.id;
