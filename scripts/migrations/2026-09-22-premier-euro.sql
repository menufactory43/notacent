-- 2026-09-22 · Premier euro. Not a Cent liste les apps au travail vérifié qui n'ont pas encore gagné d'argent,
-- quel que soit leur modèle économique. Le revenu est déclaré par le maker, le travail reste lu dans le repo.
-- À appliquer une fois : node --env-file=.env.local scripts/migrate.mjs scripts/migrations/2026-09-22-premier-euro.sql
-- (migrate.mjs l'inscrit dans schema_migrations et ne la rejoue pas). Retour arrière : le fichier .down.sql à côté.

-- Le revenu : d'où vient ce qu'on en dit. null = rien de déclaré, 'declared' = sur l'honneur du maker.
-- La place d'une preuve plus tard ('stripe', 'revenuecat', 'asc') : même colonne, rien d'autre à changer.
alter table apps add column if not exists revenue_source text;
alter table apps add column if not exists revenue_declared_at timestamptz;
-- Le premier euro : la date déclarée, et les jours actifs comptés jusqu'à ce jour-là (figés au moment de la déclaration).
alter table apps add column if not exists first_euro_at date;
alter table apps add column if not exists first_euro_days int;

-- Le modèle économique devient une info neutre : free, donations, one_time, subscription, freemium, unknown.
-- Il ne classe plus rien. Par défaut : unknown, puisque personne ne l'a dit.
alter table apps alter column pricing set default 'unknown';
-- « paid » n'existe plus : c'était un achat, on le lit comme un achat unique. Le maker corrige s'il s'agit d'un abonnement.
update apps set pricing = 'one_time' where pricing = 'paid';
-- Une fiche non réclamée n'a jamais déclaré « free » : c'était la valeur par défaut de la colonne.
update apps a set pricing = 'unknown' from users u where u.id = a.user_id and not coalesce(u.claimed, true) and a.pricing = 'free';
update apps set pricing = 'unknown' where pricing is null or pricing not in ('free', 'donations', 'one_time', 'subscription', 'freemium', 'unknown');

-- L'index du classement ne passe plus par le prix.
drop index if exists apps_rank;
create index if not exists apps_board on apps (published, status, active_days desc);
create index if not exists apps_first_euro on apps (first_euro_at) where first_euro_at is not null;
