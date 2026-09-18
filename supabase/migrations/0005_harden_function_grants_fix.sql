-- 0004 a fait `revoke ... from public`, mais Supabase accorde EXECUTE sur les
-- fonctions du schéma public directement aux rôles anon/authenticated/service_role
-- (default privileges), pas via PUBLIC : le revoke précédent n'a donc rien changé
-- pour ces rôles (vérifié via pg_proc.proacl). On révoque explicitement ici.
revoke execute on function public.handle_new_user() from anon, authenticated;

revoke execute on function public.rejoindre_trajet(uuid) from anon;
revoke execute on function public.quitter_trajet(uuid) from anon;
