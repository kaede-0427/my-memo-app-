-- projectsにアイコンURL列を追加（画像URL or null）
alter table projects add column if not exists icon text default null;

-- memosにタイトル列を追加（複数メモページ対応）
alter table memos add column if not exists title text not null default 'メモ';
