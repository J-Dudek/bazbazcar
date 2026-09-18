-- Durcissement des droits d'exécution (cf. advisor "security definer function
-- executable" déclenché après 0001/0003) :
-- - handle_new_user ne doit être appelée que par le trigger on_auth_user_created,
--   jamais en RPC direct -> on retire EXECUTE à public (et donc anon/authenticated).
-- - rejoindre_trajet/quitter_trajet ne doivent être appelables que par un
--   utilisateur connecté, pas par anon (PUBLIC accorde EXECUTE par défaut à la
--   création d'une fonction, même si on a déjà fait un GRANT ... TO authenticated
--   juste après).
-- is_admin/is_valide restent exécutables par anon/authenticated : elles sont
-- invoquées à l'intérieur des policies RLS pour ces deux rôles et ne renvoient
-- rien de plus que ce que l'utilisateur peut déjà lire sur son propre profil.
revoke execute on function public.handle_new_user() from public;

revoke execute on function public.rejoindre_trajet(uuid) from public;
revoke execute on function public.quitter_trajet(uuid) from public;
grant execute on function public.rejoindre_trajet(uuid) to authenticated;
grant execute on function public.quitter_trajet(uuid) to authenticated;
