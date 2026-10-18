-- Défait 2026-10-18-image-version.sql
alter table apps drop column if exists image_at;
