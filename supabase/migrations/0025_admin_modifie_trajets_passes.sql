-- Exception demandée par l'utilisateur à la lecture seule des événements
-- passés (0024) : un admin doit pouvoir corriger un trajet (adresse, horaire,
-- places) après coup en cas d'erreur de saisie, même sur un événement déjà
-- passé et même s'il n'en est pas le conducteur. Seule la modification est
-- concernée : proposer/rejoindre/quitter/supprimer restent bloqués pour tous,
-- y compris les admins.
drop policy "trajets_update_owner" on trajets;
create policy "trajets_update_owner" on trajets
  for update using (
    public.is_admin()
    or (conducteur_id = auth.uid() and public.evenement_a_venir(evenement_id))
  );

create or replace function public.modifier_trajet(
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
  v_evenement_id uuid;
  v_inscrits int;
  v_nouvelles_disponibles int;
begin
  select places_totales, places_disponibles, conducteur_id, evenement_id
    into v_places_totales, v_places_disponibles, v_conducteur_id, v_evenement_id
  from trajets
  where id = p_trajet_id
  for update;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  if v_conducteur_id <> auth.uid() and not public.is_admin() then
    raise exception 'Seul le conducteur du trajet peut le modifier';
  end if;

  if not public.is_admin() and not public.evenement_a_venir(v_evenement_id) then
    raise exception 'Cet événement est déjà passé';
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
