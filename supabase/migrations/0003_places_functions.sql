-- Fonctions transactionnelles pour l'inscription/désinscription à un trajet.
-- Voir CLAUDE.md §3 : la décrémentation ne doit jamais passer par un `update`
-- fait côté client, sinon deux inscriptions simultanées peuvent créer une
-- place négative. `update ... where places_disponibles > 0` verrouille la
-- ligne (row lock) le temps de la transaction, ce qui sérialise les appels
-- concurrents pour un même trajet.
--
-- security definer est nécessaire : un passager qui n'est pas le conducteur
-- n'a pas le droit d'UPDATE la ligne trajets (policy "trajets_update_owner"),
-- donc en security invoker l'update serait filtré par RLS et retournerait
-- toujours 0 ligne. La fonction elle-même agit comme couche d'autorisation
-- (passager_id est forcé à auth.uid(), jamais pris en paramètre).
create function public.rejoindre_trajet(p_trajet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if not public.is_valide() then
    raise exception 'Compte non validé';
  end if;

  insert into inscriptions (trajet_id, passager_id)
  values (p_trajet_id, auth.uid());

  update trajets
  set places_disponibles = places_disponibles - 1
  where id = p_trajet_id
    and places_disponibles > 0;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Plus de place disponible sur ce trajet';
  end if;
end;
$$;

create function public.quitter_trajet(p_trajet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from inscriptions
  where trajet_id = p_trajet_id
    and passager_id = auth.uid();

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Inscription introuvable';
  end if;

  update trajets
  set places_disponibles = places_disponibles + 1
  where id = p_trajet_id;
end;
$$;

grant execute on function public.rejoindre_trajet(uuid) to authenticated;
grant execute on function public.quitter_trajet(uuid) to authenticated;
