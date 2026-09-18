-- Prévient un membre par email dès que son compte passe à « valide » (validation
-- depuis l'écran « Gérer les membres »). Même mécanisme que les autres
-- notifications : envoyer_emails (0020) lit la clé Resend et l'expéditeur dans le
-- Vault, échappe les données saisies par l'utilisateur et ne fait rien tant que
-- `resend_api_key` n'existe pas (comportement voulu en local).
--
-- Le trigger ne se déclenche que sur une TRANSITION vers « valide » : ni sur un
-- changement de rôle ou de nom, ni sur un UPDATE qui laisse le statut inchangé.
--
-- Comptes invités : GoTrue crée l'utilisateur (INSERT) puis n'écrit `invited_at`
-- qu'ensuite, par un UPDATE (sendInvite). handle_new_user (0010) les voit donc
-- sans `invited_at` et les crée « en_attente » ; l'edge function invite-membres
-- les passe à « valide » juste après. Pour le trigger, c'est une transition comme
-- une autre : sans garde, l'invité recevrait « compte activé » en même temps que
-- son invitation. `invited_at` est déjà renseigné à ce moment-là, on s'en sert
-- pour ne rien envoyer (un invité re-validé plus tard n'est pas prévenu non plus).
--
-- Le texte n'affirme pas QUI a activé le compte : il reste vrai quel que soit
-- l'auteur du changement.
create function public.notifier_membre_compte_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom text := trim(coalesce(new.prenom, ''));
begin
  if exists (select 1 from auth.users where id = new.id and invited_at is not null) then
    return new;
  end if;

  perform public.envoyer_emails(
    array[new.email],
    'Ton compte bazbazcar est activé',
    '<p>' || case when v_prenom = '' then 'Bonjour,' else 'Bonjour ' || public.echapper_html(v_prenom) || ',' end || '</p>'
      || '<p>Bonne nouvelle : ton compte bazbazcar vient d''être activé.</p>'
      || '<p>Tu peux dès maintenant te connecter pour proposer ou rejoindre des trajets vers les événements de l''association.</p>'
  );

  return new;
end;
$$;

-- Mêmes précautions que 0004/0005 : fonction utilisable uniquement via le trigger.
revoke execute on function public.notifier_membre_compte_active() from public, anon, authenticated;

create trigger notifier_membre_apres_validation
  after update of statut on public.profiles
  for each row
  when (new.statut = 'valide' and old.statut is distinct from 'valide')
  execute function public.notifier_membre_compte_active();
