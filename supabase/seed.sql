-- Données de développement local uniquement. Rejoué à chaque `supabase db
-- reset` (voir supabase/config.toml [db.seed]) — ne s'exécute jamais sur le
-- projet distant (`db push`/`db remote` n'appliquent que supabase/migrations).
--
-- Crée un compte admin déjà validé pour pouvoir se connecter immédiatement
-- après un reset, sans repasser par l'inscription + validation manuelle.
-- Identifiants : admin@bazbazcar.local / password123
do $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  -- GoTrue lit confirmation_token/recovery_token/... comme des string Go non
  -- nullables : les laisser à NULL (comportement par défaut de la colonne)
  -- fait échouer *toute* authentification avec "converting NULL to string is
  -- unsupported". Il faut les forcer explicitement à ''.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'admin@bazbazcar.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nom', 'Admin', 'prenom', 'Dev'),
    '', '', '', '', '', '', '', '',
    now(),
    now()
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', 'admin@bazbazcar.local'),
    'email',
    now(),
    now(),
    now()
  );

  -- Le trigger on_auth_user_created (0001, redéfini en 0010) vient de créer
  -- le profil en statut='en_attente' — on le fait passer admin/validé.
  update public.profiles
  set role = 'admin', statut = 'valide'
  where id = v_user_id;
end $$;
