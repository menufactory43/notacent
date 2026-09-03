create table if not exists users (
  id serial primary key,
  github_id bigint unique not null,
  login text not null,
  name text,
  avatar_url text,
  access_token text,
  installation_id bigint,
  created_at timestamptz default now()
);
create table if not exists apps (
  id serial primary key,
  user_id int references users(id) on delete cascade,
  repo_id bigint unique not null,
  full_name text not null,
  slug text unique not null,
  name text not null,
  description text,
  language text,
  private boolean default false,
  homepage text,
  url text,
  image_url text,
  longest text,
  tool text,
  pricing text default 'free',
  status text default 'polishing',
  first_commit timestamptz,
  last_commit timestamptz,
  commits int default 0,
  active_days int default 0,
  active_days_30 int default 0,
  best_streak_weeks int default 0,
  weekly int[] default '{}',
  bravos int default 0,
  clicks int default 0,
  published boolean default false,
  refreshed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists apps_rank on apps (published, pricing, status, active_days desc);
create table if not exists activity (
  id serial primary key,
  app_id int references apps(id) on delete cascade,
  kind text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists activity_recent on activity (created_at desc);
alter table apps add column if not exists image bytea;
alter table apps add column if not exists image_type text;
create table if not exists sponsors (
  id serial primary key,
  app_id int references apps(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  amount_cents int not null,
  stripe_session text unique,
  created_at timestamptz default now()
);
create index if not exists sponsors_active on sponsors (ends_at desc);
alter table apps add column if not exists tagline text;
