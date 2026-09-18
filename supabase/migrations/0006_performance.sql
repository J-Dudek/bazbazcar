-- Advisories perf après 0001-0003 : index manquants sur les FK, et
-- `auth.uid()` appelé en clair dans les policies (ré-évalué à chaque ligne).
-- Le pattern `(select auth.uid())` permet au planner de la mettre en InitPlan
-- (évaluée une fois par requête). Voir
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- On ne touche pas à l'avertissement "multiple permissive policies" : les
-- policies sont volontairement séparées par cas d'usage pour rester lisibles
-- et faciles à auditer (cf. CLAUDE.md §5), le coût est négligeable à l'échelle
-- d'une association.

create index if not exists evenements_created_by_idx on evenements (created_by);
create index if not exists trajets_conducteur_id_idx on trajets (conducteur_id);
create index if not exists trajets_evenement_id_idx on trajets (evenement_id);
create index if not exists inscriptions_passager_id_idx on inscriptions (passager_id);

alter policy "profiles_select_self" on profiles
  using (id = (select auth.uid()));

alter policy "profiles_select_co_trajet" on profiles
  using (
    exists (
      select 1 from inscriptions i
      join trajets t on t.id = i.trajet_id
      where i.passager_id = profiles.id
        and (t.conducteur_id = (select auth.uid()) or i.passager_id = (select auth.uid()))
    )
    or exists (
      select 1 from trajets t
      where t.conducteur_id = profiles.id
        and exists (
          select 1 from inscriptions i2
          where i2.trajet_id = t.id and i2.passager_id = (select auth.uid())
        )
    )
  );

alter policy "profiles_update_self" on profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = 'membre');

alter policy "trajets_insert_valide" on trajets
  with check (
    conducteur_id = (select auth.uid()) and (public.is_valide() or public.is_admin())
  );

alter policy "trajets_update_owner" on trajets
  using (conducteur_id = (select auth.uid()) or public.is_admin());

alter policy "trajets_delete_owner" on trajets
  using (conducteur_id = (select auth.uid()) or public.is_admin());

alter policy "inscriptions_select_self" on inscriptions
  using (passager_id = (select auth.uid()));

alter policy "inscriptions_select_conducteur" on inscriptions
  using (
    exists (
      select 1 from trajets t
      where t.id = inscriptions.trajet_id and t.conducteur_id = (select auth.uid())
    )
    or public.is_admin()
  );

alter policy "inscriptions_insert_self" on inscriptions
  with check (passager_id = (select auth.uid()) and public.is_valide());

alter policy "inscriptions_delete_self" on inscriptions
  using (passager_id = (select auth.uid()) or public.is_admin());
