-- Comme pour 0004/0005 : les grants par défaut de Supabase vont directement à
-- anon/authenticated (pas via PUBLIC), donc `revoke ... from public` seul ne
-- suffit pas. La fonction se protège déjà elle-même (raise exception si
-- !is_admin()), mais autant garder les grants cohérents avec le reste.
revoke execute on function public.statistiques_membres() from anon;
