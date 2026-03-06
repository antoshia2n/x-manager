-- X Manager スキーマ
-- Supabase の SQL Editor で実行してください

-- 設定（1行のみ）
create table if not exists xm_settings (
  id            int primary key default 1,
  sound_enabled bool    default true,
  reset_hour    int     default 0,
  session_target int    default 3,
  post_labels   jsonb   default '["引用","図解","長文","記事","フック","ストーリー","リスト","共感","日常"]',
  rule_categories jsonb default '["フック構成","投稿タイミング","画像・図解","リプライ","引用","文章スタイル","その他"]',
  action_items  jsonb   default '[{"id":"a1","label":"リプライ","color":"#E09030","target":30},{"id":"a2","label":"引用","color":"#D04090","target":5},{"id":"a3","label":"投稿","color":"#2DC98A","target":3},{"id":"a4","label":"記事投稿","color":"#8050D8","target":1}]',
  kpi_items     jsonb   default '[{"id":"k1","label":"インプレッション","unit":"回","daily_target":10000,"monthly_target":300000,"color":"#4A6EF0","analyticsKey":"impressions"},{"id":"k2","label":"フォロワー増","unit":"人","daily_target":10,"monthly_target":200,"color":"#2DC98A","analyticsKey":"net_follows"},{"id":"k3","label":"プロフィール訪問","unit":"回","daily_target":500,"monthly_target":15000,"color":"#8050D8","analyticsKey":"profile_visits"}]'
);
insert into xm_settings (id) values (1) on conflict (id) do nothing;

-- 行動ログ（日次）
create table if not exists xm_actions (
  id         bigserial primary key,
  date       text unique not null,
  sessions   int  default 0,
  focus_min  int  default 0,
  counts     jsonb default '{}'
);

-- ポスト
create table if not exists xm_posts (
  id          bigserial primary key,
  date        text not null,
  url         text default '',
  title       text not null,
  labels      jsonb default '[]',
  rank        text default 'B',
  type        text default 'own',
  memo        text default '',
  impressions int,
  likes       int,
  created_at  timestamptz default now()
);

-- アナリティクス（日次）
create table if not exists xm_analytics (
  id              bigserial primary key,
  date            text unique not null,
  impressions     int default 0,
  followers       int default 0,
  profile_visits  int default 0,
  new_follows     int default 0,
  unfollows       int default 0
);

-- 週次振り返り
create table if not exists xm_reviews (
  id          bigserial primary key,
  week_start  text unique not null,
  memo        text default '',
  next_goal   text default ''
);

-- ナレッジ：ルールブック
create table if not exists xm_rules (
  id           bigserial primary key,
  cat          text not null,
  labels       jsonb default '[]',
  title        text not null,
  body         text default '',
  confidence   int  default 3,
  source_title text default '',
  updated      text not null,
  created_at   timestamptz default now()
);

-- ナレッジ：仮説検証
create table if not exists xm_hyps (
  id          bigserial primary key,
  title       text not null,
  hypothesis  text default '',
  method      text default '',
  result      text default '',
  conclusion  text default '',
  status      text default '仮説中',
  start_date  text,
  end_date    text,
  promoted    bool default false,
  created_at  timestamptz default now()
);

-- ナレッジ：テンプレート
create table if not exists xm_tmpls (
  id         bigserial primary key,
  title      text not null,
  body       text default '',
  tags       jsonb default '[]',
  created_at timestamptz default now()
);
