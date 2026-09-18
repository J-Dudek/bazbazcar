-- Statistiques admin : places proposées (conducteur) / trajets rejoints (passager)
-- par membre. Fonction plutôt que vue : l'accès doit être strictement réservé
-- aux admins, or une vue security_invoker resterait soumise aux policies RLS
-- normales des tables sous-jacentes (donc partiellement lisible par un membre
-- non-admin via profiles_select_valide_membres) — la fonction vérifie
-- explicitement is_admin() et lève une exception sinon, comme rejoindre_trajet
-- /quitter_trajet.
create function public.statistiques_membres()
returns table (
  id uuid,
  nom text,
  prenom text,
  nb_trajets_proposes bigint,
  nb_places_proposees bigint,
  nb_trajets_rejoints bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;

  return query
  select
    p.id,
    p.nom,
    p.prenom,
    coalesce(t.nb_trajets, 0) as nb_trajets_proposes,
    coalesce(t.nb_places, 0) as nb_places_proposees,
    coalesce(i.nb_rejoints, 0) as nb_trajets_rejoints
  from profiles p
  left join (
    select conducteur_id, count(*) as nb_trajets, sum(places_totales) as nb_places
    from trajets
    group by conducteur_id
  ) t on t.conducteur_id = p.id
  left join (
    select passager_id, count(*) as nb_rejoints
    from inscriptions
    group by passager_id
  ) i on i.passager_id = p.id
  order by p.nom, p.prenom;
end;
$$;

revoke execute on function public.statistiques_membres() from public;
grant execute on function public.statistiques_membres() to authenticated;
