-- Retour arrière de 2026-09-30-plateformes-bravos.sql.
-- node --env-file=.env.local scripts/migrate.mjs scripts/migrations/2026-09-30-plateformes-bravos.down.sql
-- La plateforme principale redevient la seule ; les votes sont perdus, le compteur apps.bravos reste.
update apps set platform = platforms[1] where cardinality(platforms) > 0;
drop index if exists apps_platforms;
alter table apps drop column if exists platforms;
drop table if exists bravo_votes;
