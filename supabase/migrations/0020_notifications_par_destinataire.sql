-- Deux défauts corrigés dans les notifications (0010, 0015, 0017, 0019) :
--
-- 1. Tous les destinataires étaient mis dans un seul champ `to` : chacun voyait
--    les adresses des autres (fuite de données personnelles, et signal de spam),
--    et Resend refuse plus de 50 destinataires par email — au-delà, la requête
--    échouait et personne ne recevait rien. On envoie désormais un email par
--    destinataire, via l'endpoint /emails/batch (100 emails par requête au plus).
--
-- 2. Prénom, nom, email, adresse de départ, titre et lieu étaient insérés tels
--    quels dans le HTML : n'importe qui pouvait s'inscrire avec du HTML dans son
--    prénom et le faire partir aux admins depuis notre propre domaine. Tout ce
--    qui vient d'un utilisateur est maintenant échappé.

-- Échappe le texte destiné à être inséré dans du HTML.
create function public.echapper_html(p_texte text)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(replace(replace(
    coalesce(p_texte, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- Envoie le même email à chaque destinataire, un message par personne. Ne fait
-- rien tant que la clé `resend_api_key` n'existe pas dans le Vault (comportement
-- voulu en local), ni si la liste est vide.
--
-- Volontairement SANS `security definer` : elle lit la clé API du Vault, donc
-- elle ne doit fonctionner que lorsqu'elle est appelée depuis les fonctions
-- ci-dessous (qui, elles, s'exécutent avec les droits de leur propriétaire). Si
-- un jour un `grant execute` trop large la rendait appelable depuis l'API, elle
-- échouerait faute d'accès au Vault au lieu de laisser envoyer des emails en
-- notre nom.
--
-- Au-delà de 100 destinataires, plusieurs requêtes partent d'un coup : Resend
-- limite le débit de son API, à surveiller si l'association grossit beaucoup.
create function public.envoyer_emails(p_destinataires text[], p_sujet text, p_html text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_api_key text;
  v_expediteur text;
  v_debut int;
begin
  if coalesce(array_length(p_destinataires, 1), 0) = 0 then
    return;
  end if;

  select decrypted_secret into v_api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key'
  limit 1;

  if v_api_key is null then
    return;
  end if;

  v_expediteur := public.email_expediteur();

  for v_debut in 1..array_length(p_destinataires, 1) by 100 loop
    perform net.http_post(
      url := 'https://api.resend.com/emails/batch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_api_key,
        'Content-Type', 'application/json'
      ),
      body := (
        select jsonb_agg(jsonb_build_object(
          'from', v_expediteur,
          'to', jsonb_build_array(d.destinataire),
          -- l'objet est du texte brut, mais il peut contenir un nom saisi par
          -- un utilisateur : pas de saut de ligne dans un en-tête d'email
          'subject', regexp_replace(p_sujet, '[\r\n]+', ' ', 'g'),
          'html', p_html
        ))
        from unnest(p_destinataires[v_debut : v_debut + 99]) as d(destinataire)
      )
    );
  end loop;
end;
$$;

-- Aucune des deux ne doit être appelable depuis l'API (mêmes précautions que
-- 0004/0005 : les grants par défaut vont directement à anon/authenticated).
revoke execute on function public.echapper_html(text) from public, anon, authenticated;
revoke execute on function public.envoyer_emails(text[], text, text) from public, anon, authenticated;

-- `create or replace` conserve les triggers et les grants existants.
create or replace function public.notifier_admins_nouveau_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_emails text[];
  v_nom_complet text := trim(coalesce(new.prenom, '') || ' ' || coalesce(new.nom, ''));
begin
  select array_agg(email) into v_admin_emails
  from public.profiles
  where role = 'admin';

  perform public.envoyer_emails(
    v_admin_emails,
    'Nouveau compte à valider — ' || v_nom_complet,
    '<p>' || public.echapper_html(v_nom_complet)
      || ' (' || public.echapper_html(new.email) || ') vient de créer un compte sur bazbazcar et attend une validation.</p>'
      || '<p>Rends-toi dans l''espace admin (Gérer les membres) pour le valider.</p>'
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
  v_passager_emails text[];
  v_titre text;
begin
  select array_agg(p.email) into v_passager_emails
  from inscriptions i
  join profiles p on p.id = i.passager_id
  where i.trajet_id = old.id;

  select titre into v_titre
  from evenements
  where id = old.evenement_id;

  perform public.envoyer_emails(
    v_passager_emails,
    'Trajet annulé — ' || coalesce(v_titre, 'bazbazcar'),
    '<p>Le trajet que tu avais rejoint (départ <strong>' || public.echapper_html(old.adresse_depart)
      || '</strong> à ' || to_char(old.horaire_depart, 'HH24:MI')
      || ', pour « ' || public.echapper_html(coalesce(v_titre, 'un événement')) || ' »)'
      || ' vient d''être annulé par le conducteur.</p>'
      || '<p>Pense à chercher un autre trajet proposé sur bazbazcar.</p>'
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
  v_membre_emails text[];
begin
  -- `is distinct from` plutôt que `<>` : reste correct si created_by est
  -- jamais NULL à l'insertion (ne devrait pas arriver, mais évite un silence
  -- total — `<> NULL` exclurait tout le monde au lieu de personne).
  select array_agg(email) into v_membre_emails
  from public.profiles
  where statut = 'valide' and id is distinct from new.created_by;

  perform public.envoyer_emails(
    v_membre_emails,
    'Nouvel événement — ' || new.titre,
    '<p>Un nouvel événement vient d''être publié sur bazbazcar :</p>'
      || '<p><strong>' || public.echapper_html(new.titre) || '</strong><br>'
      || to_char(new.date_evenement, 'DD/MM/YYYY') || ' — ' || public.echapper_html(new.lieu)
      || '<br>RDV à ' || to_char(new.horaire_rdv, 'HH24:MI') || '</p>'
      || '<p>Connecte-toi sur bazbazcar pour proposer ou rejoindre un trajet.</p>'
  );

  return new;
end;
$$;
