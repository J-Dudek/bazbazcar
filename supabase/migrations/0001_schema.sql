-- Schéma initial — voir CLAUDE.md §3
-- Étend auth.users (géré par Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  prenom text not null,
  email text not null,
  role text not null default 'membre' check (role in ('admin', 'membre')),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'valide', 'refuse')),
  created_at timestamptz not null default now()
);

-- Événements créés par les admins
create table evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  date_evenement date not null,
  lieu text not null,
  horaire_rdv time not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- Trajets proposés par les membres pour un événement
create table trajets (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references evenements(id) on delete cascade,
  conducteur_id uuid not null references profiles(id),
  adresse_depart text not null,
  horaire_depart time not null,
  places_totales int not null check (places_totales > 0),
  places_disponibles int not null check (places_disponibles >= 0),
  created_at timestamptz not null default now()
);

-- Inscriptions des passagers à un trajet
create table inscriptions (
  id uuid primary key default gen_random_uuid(),
  trajet_id uuid not null references trajets(id) on delete cascade,
  passager_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (trajet_id, passager_id) -- un membre ne peut pas s'inscrire deux fois au même trajet
);

-- Depuis le 30/10/2026, Supabase n'accorde plus automatiquement l'accès Data
-- API aux nouvelles tables de `public` : sans GRANT explicite, une base neuve
-- (`supabase db reset`, branche de preview, nouveau projet) les rendrait
-- inaccessibles via supabase-js. Pas de grant à `anon` : aucune policy RLS ne
-- lui ouvre ces tables, toute l'app passe par un utilisateur connecté.
grant select, insert, update, delete on public.profiles, public.evenements, public.trajets, public.inscriptions to authenticated;
grant select, insert, update, delete on public.profiles, public.evenements, public.trajets, public.inscriptions to service_role;

-- Un profil est créé automatiquement à l'inscription (nom/prénom/email
-- transmis via `options.data` dans supabase-js signUp, cf. AuthService).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nom, prenom, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
