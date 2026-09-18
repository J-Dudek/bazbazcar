-- Permet à un compte de se supprimer lui-même sans laisser la base dans un
-- état incohérent :
-- - evenements.created_by / commentaires.auteur_id passent en SET NULL
--   (perdre l'attribution est acceptable ; supprimer l'événement ou le
--   commentaire de quelqu'un d'autre à cause de la suppression d'un compte
--   ne l'est pas).
-- - trajets.conducteur_id et inscriptions.passager_id passent en CASCADE :
--   les trajets qu'on conduit et les places qu'on occupe disparaissent avec
--   le compte. Le trigger notifier_passagers_avant_annulation (0015) reste
--   déclenché normalement pour chaque trajet supprimé de cette façon.

alter table evenements alter column created_by drop not null;
alter table evenements drop constraint evenements_created_by_fkey;
alter table evenements add constraint evenements_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table commentaires alter column auteur_id drop not null;
alter table commentaires drop constraint commentaires_auteur_id_fkey;
alter table commentaires add constraint commentaires_auteur_id_fkey
  foreign key (auteur_id) references profiles(id) on delete set null;

alter table trajets drop constraint trajets_conducteur_id_fkey;
alter table trajets add constraint trajets_conducteur_id_fkey
  foreign key (conducteur_id) references profiles(id) on delete cascade;

alter table inscriptions drop constraint inscriptions_passager_id_fkey;
alter table inscriptions add constraint inscriptions_passager_id_fkey
  foreign key (passager_id) references profiles(id) on delete cascade;

-- places_disponibles doit rester synchronisé même quand une inscription
-- disparaît par un autre chemin que quitter_trajet() (ex. cascade depuis la
-- suppression d'un compte passager ci-dessus). On délègue la
-- ré-incrémentation à un trigger générique sur DELETE et on retire le
-- doublon correspondant dans quitter_trajet() (sinon double incrément quand
-- l'appel passe par la fonction).
create function public.liberer_place()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update trajets set places_disponibles = places_disponibles + 1 where id = old.trajet_id;
  return old;
end;
$$;

revoke execute on function public.liberer_place() from public, anon, authenticated;

create trigger liberer_place_apres_desinscription
  after delete on inscriptions
  for each row
  execute function public.liberer_place();

create or replace function public.quitter_trajet(p_trajet_id uuid)
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
end;
$$;
