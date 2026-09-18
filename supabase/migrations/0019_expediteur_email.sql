-- Les notifications (0010, 0015, 0017) partaient toutes de
-- « bazbazcar <onboarding@resend.dev> », l'expéditeur de test de Resend : domaine
-- partagé avec tous les utilisateurs de Resend, sans lien avec le nôtre (SPF/DKIM
-- non alignés) et limité au propriétaire du compte — d'où les mails en spam.
--
-- L'expéditeur est désormais lu dans Supabase Vault, comme la clé API. À
-- configurer une seule fois via le SQL Editor du dashboard, avec une adresse d'un
-- domaine VÉRIFIÉ chez Resend (Domains) :
--   select vault.create_secret('bazbazcar <notifications@mondomaine.fr>', 'email_expediteur');
-- Tant que ce secret n'existe pas, on retombe sur l'expéditeur de test pour ne pas
-- casser les notifications déjà en place.
create function public.email_expediteur()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'email_expediteur' limit 1),
    'bazbazcar <onboarding@resend.dev>'
  );
$$;

revoke execute on function public.email_expediteur() from public, anon, authenticated;

-- Les trois fonctions ci-dessous sont reprises telles quelles de 0010, 0015 et
-- 0017 : seule la ligne 'from' change. `create or replace` conserve les triggers
-- et les grants existants.
create or replace function public.notifier_admins_nouveau_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
  v_admin_emails text[];
begin
  select decrypted_secret into v_api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key'
  limit 1;

  if v_api_key is null then
    return new;
  end if;

  select array_agg(email) into v_admin_emails
  from public.profiles
  where role = 'admin';

  if v_admin_emails is null or array_length(v_admin_emails, 1) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', public.email_expediteur(),
      'to', to_jsonb(v_admin_emails),
      'subject', 'Nouveau compte à valider — ' || trim(coalesce(new.prenom, '') || ' ' || coalesce(new.nom, '')),
      'html', '<p>' || trim(coalesce(new.prenom, '') || ' ' || coalesce(new.nom, ''))
        || ' (' || new.email || ') vient de créer un compte sur bazbazcar et attend une validation.</p>'
        || '<p>Rends-toi dans l''espace admin (Gérer les membres) pour le valider.</p>'
    )
  );

  return new;
end;
$$;

create or replace function public.notifier_passagers_annulation_trajet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
  v_passager_emails text[];
  v_evenement record;
begin
  select decrypted_secret into v_api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key'
  limit 1;

  if v_api_key is null then
    return old;
  end if;

  select array_agg(p.email) into v_passager_emails
  from inscriptions i
  join profiles p on p.id = i.passager_id
  where i.trajet_id = old.id;

  if v_passager_emails is null or array_length(v_passager_emails, 1) = 0 then
    return old;
  end if;

  select titre into v_evenement
  from evenements
  where id = old.evenement_id;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', public.email_expediteur(),
      'to', to_jsonb(v_passager_emails),
      'subject', 'Trajet annulé — ' || coalesce(v_evenement.titre, 'bazbazcar'),
      'html', '<p>Le trajet que tu avais rejoint (départ <strong>' || old.adresse_depart
        || '</strong> à ' || to_char(old.horaire_depart, 'HH24:MI')
        || ', pour « ' || coalesce(v_evenement.titre, 'un événement') || ' »)'
        || ' vient d''être annulé par le conducteur.</p>'
        || '<p>Pense à chercher un autre trajet proposé sur bazbazcar.</p>'
    )
  );

  return old;
end;
$$;

create or replace function public.notifier_membres_nouvel_evenement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
  v_membre_emails text[];
begin
  select decrypted_secret into v_api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key'
  limit 1;

  if v_api_key is null then
    return new;
  end if;

  -- `is distinct from` plutôt que `<>` : reste correct si created_by est
  -- jamais NULL à l'insertion (ne devrait pas arriver, mais évite un silence
  -- total — `<> NULL` exclurait tout le monde au lieu de personne).
  select array_agg(email) into v_membre_emails
  from public.profiles
  where statut = 'valide' and id is distinct from new.created_by;

  if v_membre_emails is null or array_length(v_membre_emails, 1) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', public.email_expediteur(),
      'to', to_jsonb(v_membre_emails),
      'subject', 'Nouvel événement — ' || new.titre,
      'html', '<p>Un nouvel événement vient d''être publié sur bazbazcar :</p>'
        || '<p><strong>' || new.titre || '</strong><br>'
        || to_char(new.date_evenement, 'DD/MM/YYYY') || ' — ' || new.lieu
        || '<br>RDV à ' || to_char(new.horaire_rdv, 'HH24:MI') || '</p>'
        || '<p>Connecte-toi sur bazbazcar pour proposer ou rejoindre un trajet.</p>'
    )
  );

  return new;
end;
$$;
