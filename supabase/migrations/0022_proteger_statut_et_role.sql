-- Faille corrigée : la policy profiles_update_self (0002) vérifie que le rôle
-- reste « membre » mais ne dit rien du `statut`. Un membre en attente pouvait donc
-- se valider lui-même par un simple UPDATE via l'API (PATCH /rest/v1/profiles
-- avec {"statut": "valide"} sur sa propre ligne), et contourner ainsi la
-- validation par un administrateur.
--
-- Ce trigger réserve tout changement de `statut` ou de `role` aux administrateurs
-- lorsque la requête vient de l'API (rôles `anon` et `authenticated`). Il laisse
-- passer :
--   - les administrateurs (écran « Gérer les membres ») ;
--   - l'edge function invite-membres, qui passe par le rôle `service_role` ;
--   - le SQL Editor et les migrations (rôle `postgres`), par exemple pour créer le
--     premier administrateur (cf. README).
--
-- Volontairement SANS `security definer` : la garde repose sur `current_user`, qui
-- vaut le rôle de l'appelant (`authenticated`...). En `security definer` il vaudrait
-- toujours le propriétaire de la fonction et la garde ne bloquerait plus personne.
create function public.proteger_statut_et_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier le statut ou le rôle d''un compte'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Mêmes précautions que 0004/0005 : fonction utilisable uniquement via le trigger.
revoke execute on function public.proteger_statut_et_role() from public, anon, authenticated;

-- `of statut, role` + `when` : le trigger ne s'exécute que si l'un des deux
-- change réellement, donc jamais sur une mise à jour du nom ou du prénom (ni sur
-- un UPDATE qui renvoie le même statut).
create trigger proteger_statut_et_role
  before update of statut, role on public.profiles
  for each row
  when (new.statut is distinct from old.statut or new.role is distinct from old.role)
  execute function public.proteger_statut_et_role();
