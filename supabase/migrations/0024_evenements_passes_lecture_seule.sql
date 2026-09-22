-- Les trajets liés à un événement passé passent en lecture seule (simple
-- consultation) : plus possible d'en proposer, d'en rejoindre/quitter, de les
-- modifier ni de les supprimer, y compris pour un admin. Les policies RLS
-- couvrent les appels PostgREST directs (insert/update/delete depuis
-- Angular) ; rejoindre_trajet/quitter_trajet/modifier_trajet sont SECURITY
-- DEFINER (0003, 0023) et contournent donc RLS -> le verrou doit être répété
-- explicitement dans chacune. Voir CLAUDE.md §5 : ne jamais compenser une
-- policy manquante par un filtre côté client.

create function public.evenement_a_venir(p_evenement_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from evenements
    where id = p_evenement_id and date_evenement >= current_date
  );
$$;

-- trajets --------------------------------------------------------------
drop policy "trajets_insert_valide" on trajets;
create policy "trajets_insert_valide" on trajets
  for insert with check (
    conducteur_id = auth.uid()
    and (public.is_valide() or public.is_admin())
    and public.evenement_a_venir(evenement_id)
  );

drop policy "trajets_update_owner" on trajets;
create policy "trajets_update_owner" on trajets
  for update using (
    (conducteur_id = auth.uid() or public.is_admin())
    and public.evenement_a_venir(evenement_id)
  );

drop policy "trajets_delete_owner" on trajets;
create policy "trajets_delete_owner" on trajets
  for delete using (
    (conducteur_id = auth.uid() or public.is_admin())
    and public.evenement_a_venir(evenement_id)
  );

-- inscriptions -----------------------------------------------------------
drop policy "inscriptions_insert_self" on inscriptions;
create policy "inscriptions_insert_self" on inscriptions
  for insert with check (
    passager_id = auth.uid()
    and public.is_valide()
    and exists (
      select 1 from trajets t
      where t.id = inscriptions.trajet_id and public.evenement_a_venir(t.evenement_id)
    )
  );

drop policy "inscriptions_delete_self" on inscriptions;
create policy "inscriptions_delete_self" on inscriptions
  for delete using (
    (passager_id = auth.uid() or public.is_admin())
    and exists (
      select 1 from trajets t
      where t.id = inscriptions.trajet_id and public.evenement_a_venir(t.evenement_id)
    )
  );

-- rejoindre_trajet / quitter_trajet / modifier_trajet : SECURITY DEFINER,
-- donc le verrou doit être vérifié explicitement, RLS ne s'applique pas ici.
create or replace function public.rejoindre_trajet(p_trajet_id uuid)
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

  if not exists (
    select 1 from trajets t
    where t.id = p_trajet_id and public.evenement_a_venir(t.evenement_id)
  ) then
    raise exception 'Cet événement est déjà passé';
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

create or replace function public.quitter_trajet(p_trajet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if not exists (
    select 1 from trajets t
    where t.id = p_trajet_id and public.evenement_a_venir(t.evenement_id)
  ) then
    raise exception 'Cet événement est déjà passé';
  end if;

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

  if not public.evenement_a_venir(v_evenement_id) then
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
