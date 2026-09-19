-- Le conducteur peut déjà UPDATE sa ligne trajets (policy "trajets_update_owner",
-- 0002), mais un update direct côté client sur places_totales serait risqué :
-- un passager peut rejoindre/quitter pendant que le conducteur modifie le
-- nombre de places, et écraser places_disponibles sans tenir compte des
-- inscriptions déjà prises créerait un état incohérent (voir CLAUDE.md §3,
-- même logique que rejoindre_trajet/quitter_trajet en 0003).
--
-- `for update` verrouille la ligne le temps de la transaction : le calcul du
-- nombre d'inscrits déjà pris (places_totales - places_disponibles) reste
-- cohérent même si un rejoindre_trajet/quitter_trajet concurrent est en attente
-- sur la même ligne.
create function public.modifier_trajet(
  p_trajet_id uuid,
  p_adresse_depart text,
  p_horaire_depart time,
  p_places_totales int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_places_totales int;
  v_places_disponibles int;
  v_conducteur_id uuid;
  v_inscrits int;
  v_nouvelles_disponibles int;
begin
  select places_totales, places_disponibles, conducteur_id
    into v_places_totales, v_places_disponibles, v_conducteur_id
  from trajets
  where id = p_trajet_id
  for update;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  if v_conducteur_id <> auth.uid() and not public.is_admin() then
    raise exception 'Seul le conducteur du trajet peut le modifier';
  end if;

  if p_places_totales <= 0 then
    raise exception 'Le nombre de places doit être supérieur à 0';
  end if;

  v_inscrits := v_places_totales - v_places_disponibles;
  v_nouvelles_disponibles := p_places_totales - v_inscrits;

  if v_nouvelles_disponibles < 0 then
    raise exception
      'Impossible de descendre à % places : % passager(s) déjà inscrit(s)',
      p_places_totales, v_inscrits;
  end if;

  update trajets
  set adresse_depart = p_adresse_depart,
      horaire_depart = p_horaire_depart,
      places_totales = p_places_totales,
      places_disponibles = v_nouvelles_disponibles
  where id = p_trajet_id;
end;
$$;

grant execute on function public.modifier_trajet(uuid, text, time, int) to authenticated;
