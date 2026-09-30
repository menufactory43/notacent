-- 2026-09-30 · Plusieurs plateformes par app, et un bravo par personne.
-- À appliquer une fois : node --env-file=.env.local scripts/migrate.mjs scripts/migrations/2026-09-30-plateformes-bravos.sql
-- Retour arrière : le fichier .down.sql à côté.

-- Une app Electron sort sur Mac, Windows et Linux ; une app Flutter sur iOS et Android. La première est la principale :
-- c'est elle qui donne le rang « 3e des apps Mac ». L'ancienne colonne platform n'est plus lue, le .down.sql la remet à jour.
alter table apps add column if not exists platforms text[] not null default '{}';
update apps set platforms = array[platform] where platform is not null and platforms = '{}';
create index if not exists apps_platforms on apps using gin (platforms);

-- Le bravo n'était gardé que par un cookie : une fenêtre privée ou un curl en boucle en ajoutaient sans fin.
-- Un vote par app et par votant ; le votant est une empreinte (HMAC de l'adresse IP), jamais l'adresse elle-même.
create table if not exists bravo_votes (
  app_id int not null references apps(id) on delete cascade,
  voter text not null,
  created_at timestamptz default now(),
  primary key (app_id, voter)
);
