-- La publication de commentaires est réservée aux administrateurs (la lecture
-- reste ouverte à tout membre validé, inchangée). Suite à un retour direct :
-- "il doit y avoir uniquement les administrateurs qui peuvent mettre des
-- commentaires".
drop policy "commentaires_insert_self" on commentaires;

create policy "commentaires_insert_admin" on commentaires
  for insert with check (auteur_id = (select auth.uid()) and public.is_admin());
