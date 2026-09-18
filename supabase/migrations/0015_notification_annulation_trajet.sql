-- Prévient par email chaque passager inscrit quand le conducteur annule son
-- trajet. Trigger BEFORE DELETE (pas AFTER) : les inscriptions liées à ce
-- trajet doivent encore exister au moment de la requête (elles sont
-- supprimées juste après par le ON DELETE CASCADE de inscriptions.trajet_id).
-- Même mécanisme que notifier_admins_nouveau_compte (0010) : pg_net + clé
-- Resend dans Supabase Vault, déjà configurée.
create function public.notifier_passagers_annulation_trajet()
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
      'from', 'bazbazcar <onboarding@resend.dev>',
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

revoke execute on function public.notifier_passagers_annulation_trajet() from public, anon, authenticated;

create trigger notifier_passagers_avant_annulation
  before delete on public.trajets
  for each row
  execute function public.notifier_passagers_annulation_trajet();
