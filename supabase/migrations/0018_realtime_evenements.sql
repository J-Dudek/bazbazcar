-- Diffuse les INSERT sur evenements via Supabase Realtime, pour la popin
-- "nouvel événement" affichée aux membres déjà connectés à l'app (cf.
-- NouvelEvenementPopin côté Angular). La RLS existante (evenements_select_valide,
-- 0002) s'applique déjà aux évènements Realtime : seuls les membres
-- validés/admins reçoivent la diffusion, pas de policy supplémentaire à écrire.
alter publication supabase_realtime add table evenements;
