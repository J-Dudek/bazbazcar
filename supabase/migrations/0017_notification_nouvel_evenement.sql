-- Prévient par email tous les membres validés (hors l'admin qui vient de le
-- créer) qu'un nouvel événement a été publié. Même mécanisme que
-- notifier_admins_nouveau_compte (0010) et notifier_passagers_annulation_trajet
-- (0015) : pg_net + clé Resend dans Supabase Vault, déjà configurée.
create function public.notifier_membres_nouvel_evenement()
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
      'from', 'bazbazcar <onboarding@resend.dev>',
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

revoke execute on function public.notifier_membres_nouvel_evenement() from public, anon, authenticated;

create trigger notifier_membres_apres_creation_evenement
  after insert on public.evenements
  for each row
  execute function public.notifier_membres_nouvel_evenement();
