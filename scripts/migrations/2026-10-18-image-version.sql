-- 2026-10-18 · Une version par image, pour que le CDN la garde.
-- À appliquer une fois : node --env-file=.env.local scripts/migrate.mjs scripts/migrations/2026-10-18-image-version.sql
-- Retour arrière : le fichier .down.sql à côté.

-- /api/img lisait l'image dans la base à chaque affichage. L'adresse porte maintenant ?v=<image_at> : elle change avec l'image,
-- et le CDN peut garder chaque version un an sans réveiller la base.
alter table apps add column if not exists image_at timestamptz;
update apps set image_at = coalesce(refreshed_at, created_at, now()) where image is not null and image_at is null;
