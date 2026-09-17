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
-- Étoiles GitHub : elles ne classent pas, elles disent qui n'a pas encore été vu.
alter table apps add column if not exists stars int default 0;
-- Plateforme (Mac, iOS, Web, CLI…) : déduite du repo, corrigée par le maker. Sert aux pages « Parcourir ».
alter table apps add column if not exists platform text;
-- « Ouverte à une reprise » : un signal posé par le maker, on met en relation, on ne vend rien.
alter table apps add column if not exists takeover boolean default false;
create index if not exists apps_browse on apps (published, tool, platform, language);
-- Alertes gratuites : un filtre enregistré, un mail hebdo quand des apps le matchent.
create table if not exists alerts (
  id serial primary key,
  email text not null,
  locale text default 'fr',
  filter jsonb not null default '{}',
  token text unique not null,
  confirmed boolean default true,
  last_sent timestamptz,
  created_at timestamptz default now()
);
create unique index if not exists alerts_unique on alerts (email, filter);
-- Fiches non réclamées : un compte créé depuis l'identifiant GitHub public, sans jeton. Se connecter = réclamer.
alter table users add column if not exists claimed boolean default true;
-- « Non » : la fiche part et on ne relistera jamais ce github_id. Le login reste possible, c'est alors son choix.
alter table users add column if not exists blocked boolean default false;
-- Prospection : les candidats trouvés par scripts/prospect.mjs, puis l'état de chaque mail (un seul, jamais de relance).
create table if not exists outreach (
  id serial primary key,
  repo_id bigint unique not null,
  full_name text not null,
  name text not null,
  description text,
  language text,
  homepage text,
  topics text[] default '{}',
  stars int default 0,
  contributors int default 1,
  has_release boolean default false,
  repo_created timestamptz,
  pushed_at timestamptz,
  owner_id bigint not null,
  owner_login text not null,
  owner_name text,
  owner_avatar text,
  owner_email text,
  commit_email text,
  owner_blog text,
  owner_twitter text,
  owner_location text,
  metrics jsonb default '{}',
  score real default 0,
  query text,
  status text default 'found',
  app_id int references apps(id) on delete set null,
  note text,
  listed_at timestamptz,
  sent_at timestamptz,
  answered_at timestamptz,
  found_at timestamptz default now()
);
create index if not exists outreach_status on outreach (status, score desc);
-- Le registre des jours actifs : les dates connues avec au moins un commit. Pour un repo privé lu en « Metadata »
-- seul, GitHub ne donne le détail par jour que sur 52 semaines ; le cron ajoute chaque nuit ce qu'il voit.
alter table apps add column if not exists active_dates date[] default '{}';
