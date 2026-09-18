-- pg_net avait été installée dans public par défaut ; l'advisor sécurité
-- recommande de déplacer les extensions hors du schéma public (comme
-- pgcrypto/uuid-ossp déjà installées dans `extensions`).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
