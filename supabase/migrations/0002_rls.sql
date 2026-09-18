-- Row Level Security — voir CLAUDE.md §5
alter table profiles enable row level security;
alter table evenements enable row level security;
alter table trajets enable row level security;
alter table inscriptions enable row level security;

-- Fonctions utilitaires (security definer pour lire profiles sans
-- redéclencher les policies de la table elle-même -> évite la récursion).
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function public.is_valide()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and statut = 'valide'
  );
$$;

-- profiles ---------------------------------------------------------------
-- un membre voit son propre profil et les profils liés aux mêmes trajets
-- (conducteur <-> passagers) ; un admin voit tout.
create policy "profiles_select_self" on profiles
  for select using (id = auth.uid());

create policy "profiles_select_admin" on profiles
  for select using (public.is_admin());

create policy "profiles_select_co_trajet" on profiles
  for select using (
    exists (
      select 1 from inscriptions i
      join trajets t on t.id = i.trajet_id
      where i.passager_id = profiles.id
        and (t.conducteur_id = auth.uid() or i.passager_id = auth.uid())
    )
    or exists (
      select 1 from trajets t
      where t.conducteur_id = profiles.id
        and exists (
          select 1 from inscriptions i2
          where i2.trajet_id = t.id and i2.passager_id = auth.uid()
        )
    )
  );

create policy "profiles_update_self" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = 'membre'); -- pas d'auto-promotion admin

create policy "profiles_update_admin" on profiles
  for update using (public.is_admin());

-- evenements ---------------------------------------------------------------
-- lecture publique aux membres authentifiés et validés ; écriture admin only.
create policy "evenements_select_valide" on evenements
  for select using (public.is_valide() or public.is_admin());

create policy "evenements_insert_admin" on evenements
  for insert with check (public.is_admin());

create policy "evenements_update_admin" on evenements
  for update using (public.is_admin());

create policy "evenements_delete_admin" on evenements
  for delete using (public.is_admin());

-- trajets --------------------------------------------------------------
-- lecture par tout membre validé ; création par tout membre validé ;
-- modification/suppression réservées au conducteur ou à un admin.
create policy "trajets_select_valide" on trajets
  for select using (public.is_valide() or public.is_admin());

create policy "trajets_insert_valide" on trajets
  for insert with check (
    conducteur_id = auth.uid() and (public.is_valide() or public.is_admin())
  );

create policy "trajets_update_owner" on trajets
  for update using (conducteur_id = auth.uid() or public.is_admin());

create policy "trajets_delete_owner" on trajets
  for delete using (conducteur_id = auth.uid() or public.is_admin());

-- inscriptions -----------------------------------------------------------
-- un membre s'inscrit/se désinscrit lui-même ; le conducteur et les admins
-- voient la liste des inscrits à un trajet.
create policy "inscriptions_select_self" on inscriptions
  for select using (passager_id = auth.uid());

create policy "inscriptions_select_conducteur" on inscriptions
  for select using (
    exists (
      select 1 from trajets t
      where t.id = inscriptions.trajet_id and t.conducteur_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "inscriptions_insert_self" on inscriptions
  for insert with check (passager_id = auth.uid() and public.is_valide());

create policy "inscriptions_delete_self" on inscriptions
  for delete using (passager_id = auth.uid() or public.is_admin());
