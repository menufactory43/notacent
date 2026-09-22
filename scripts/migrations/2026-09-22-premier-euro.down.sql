-- Retour arrière de 2026-09-22-premier-euro.sql.
-- node --env-file=.env.local scripts/migrate.mjs scripts/migrations/2026-09-22-premier-euro.down.sql
-- Perd les déclarations de revenu et les dates de premier euro. Les modèles payants redeviennent « paid »,
-- « unknown » redevient « free » (l'ancien défaut) : c'était l'état d'avant, faux compris.
update apps set pricing = 'paid' where pricing in ('one_time', 'subscription', 'freemium');
update apps set pricing = 'free' where pricing = 'unknown' or pricing is null;
alter table apps alter column pricing set default 'free';
drop index if exists apps_first_euro;
drop index if exists apps_board;
create index if not exists apps_rank on apps (published, pricing, status, active_days desc);
alter table apps drop column if exists first_euro_days;
alter table apps drop column if exists first_euro_at;
alter table apps drop column if exists revenue_declared_at;
alter table apps drop column if exists revenue_source;
