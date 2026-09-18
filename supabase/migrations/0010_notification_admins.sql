-- Notifie chaque administrateur par email quand un nouveau compte a besoin
-- d'être validé. Appelle directement l'API Resend depuis Postgres (pg_net) —
-- la clé API Resend est stockée dans Supabase Vault, jamais en clair dans une
-- migration versionnée (voir CLAUDE.md §7). À configurer une seule fois via le
-- SQL Editor du dashboard :
--   select vault.create_secret('re_xxxxxxxx', 'resend_api_key');
-- Tant que ce secret n'existe pas, la fonction ne fait rien (pas d'erreur, pas
-- de blocage de l'inscription).
create extension if not exists pg_net;

-- handle_new_user (0001) mettait toujours statut='en_attente' par défaut, y
-- compris pour les comptes créés par un admin via auth.admin.inviteUserByEmail
-- (edge function invite-membres), qui ne devraient pas déclencher cette
-- notification (l'invitation admin vaut déjà validation). GoTrue renseigne
-- `invited_at` uniquement pour ce flux d'invitation, ce qui permet de distinguer
-- les deux cas dès la création du profil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nom, prenom, email, statut)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    new.email,
    case when new.invited_at is not null then 'valide' else 'en_attente' end
  );
  return new;
end;
$$;

create function public.notifier_admins_nouveau_compte()
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
      'from', 'bazbazcar <onboarding@resend.dev>',
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

-- Comme pour handle_new_user (0004/0005) : les grants par défaut de Supabase
-- vont directement à anon/authenticated, pas via PUBLIC. On révoque les deux
-- explicitement (fonction utilisable uniquement via le trigger).
revoke execute on function public.notifier_admins_nouveau_compte() from public, anon, authenticated;

create trigger notifier_admins_apres_inscription
  after insert on public.profiles
  for each row
  when (new.statut = 'en_attente')
  execute function public.notifier_admins_nouveau_compte();
