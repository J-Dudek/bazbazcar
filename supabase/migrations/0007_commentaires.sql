-- Commentaires publics sur un événement, visibles par tous les membres validés.
create table commentaires (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references evenements(id) on delete cascade,
  auteur_id uuid not null references profiles(id),
  contenu text not null check (char_length(trim(contenu)) > 0 and char_length(contenu) <= 2000),
  created_at timestamptz not null default now()
);

alter table commentaires enable row level security;

create index commentaires_evenement_id_idx on commentaires (evenement_id);
create index commentaires_auteur_id_idx on commentaires (auteur_id);

create policy "commentaires_select_valide" on commentaires
  for select using (public.is_valide() or public.is_admin());

create policy "commentaires_insert_self" on commentaires
  for insert with check (auteur_id = (select auth.uid()) and public.is_valide());

create policy "commentaires_delete_self_or_admin" on commentaires
  for delete using (auteur_id = (select auth.uid()) or public.is_admin());

-- Pour afficher "qui a écrit ce commentaire" (prénom/nom), un membre validé doit
-- pouvoir lire le profil d'un autre membre validé, pas seulement celui d'un
-- covoitureur (profiles_select_co_trajet, déjà en place, reste trop restrictif
-- pour un commentaire posté par quelqu'un qu'on ne covoiture pas encore).
-- Comme pour profiles_select_co_trajet, la ligne entière reste techniquement
-- lisible via l'API (RLS filtre par ligne, pas par colonne) : c'est cohérent
-- avec ce qui existe déjà entre covoitureurs. Le front ne sélectionne que
-- prenom/nom dans ce contexte.
create policy "profiles_select_valide_membres" on profiles
  for select using (public.is_valide() and statut = 'valide');
