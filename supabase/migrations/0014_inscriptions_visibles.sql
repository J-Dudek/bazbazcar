-- Jusqu'ici seuls le conducteur, l'admin et le passager lui-même pouvaient
-- voir une inscription. Pour afficher "qui est déjà dans le trajet" à tout
-- membre parcourant un événement, on ajoute une policy de lecture large,
-- cohérente avec profiles_select_valide_membres (0007) : tout membre validé
-- voit les inscriptions (jointes à profiles pour prénom/nom sur le front).
create policy "inscriptions_select_valide" on inscriptions
  for select using (public.is_valide() or public.is_admin());
