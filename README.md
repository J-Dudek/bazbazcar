# bazbazcar

Application de covoiturage associatif — Angular (standalone) + Supabase (Postgres + Auth + RLS + Edge Functions) + [design-j6n](https://github.com/J-Dudek/design-j6n).

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Lancer le projet en local](#lancer-le-projet-en-local)
- [Qualité de code — lint, format, accessibilité](#qualité-de-code--lint-format-accessibilité)
- [Reproduire le projet avec d'autres comptes](#reproduire-le-projet-avec-dautres-comptes)
- [Variables d'environnement — récapitulatif](#variables-denvironnement--récapitulatif)
- [Déploiement](#déploiement)
- [Structure du projet](#structure-du-projet)

## Fonctionnalités

**Comptes & authentification**
- Inscription par email/mot de passe, confirmation d'email
- Connexion, mot de passe oublié, changement de mot de passe
- Un compte est `en_attente` par défaut : un administrateur doit le valider avant qu'il puisse proposer/rejoindre des trajets
- Un administrateur peut inviter directement une ou plusieurs personnes par email (compte pré-validé, avec ou sans droits admin) — l'invité choisit son mot de passe via le lien reçu
- Chaque compte peut modifier son prénom/nom, changer son mot de passe et supprimer son compte lui-même (`/mon-compte`)
- Email automatique aux administrateurs quand un nouveau compte a besoin d'être validé

**Événements & trajets**
- Liste des événements à venir, page de détail par événement
- Un admin crée/modifie un événement (titre, lieu, date, horaire de rendez-vous)
- Tout membre validé peut proposer un trajet (adresse de départ, horaire, nombre de places, numéro de contact facultatif)
- Rejoindre / quitter un trajet (décompte des places en transaction sécurisée, sans race condition)
- La liste des passagers déjà inscrits est visible sur chaque trajet
- Le conducteur peut annuler son trajet — les passagers inscrits sont alors prévenus automatiquement par email
- Commentaires sur un événement, réservés en écriture aux administrateurs (lecture ouverte à tous les membres validés)
- Popin temps réel (Supabase Realtime) affichée aux membres déjà connectés dès qu'un nouvel événement est publié — en plus de l'email, pas à sa place

**Espace admin**
- Gestion des membres : changer le rôle (membre/admin) et le statut (en attente/validé/refusé) de n'importe quel compte
- Statistiques : places proposées et trajets rejoints par membre
- Un admin ne peut pas supprimer son compte s'il est le seul administrateur restant

**Divers**
- Thème clair / sombre / automatique (persisté par appareil)
- Mobile-first, responsive
- Installable en PWA (icône sur l'écran d'accueil, service worker pour le chargement hors-ligne du shell de l'app)
- Popin d'installation proposée aux membres validés une fois connectés, tant que l'app n'est pas installée : prompt natif sur Chrome/Edge/Android, mode d'emploi sur iOS (Safari n'a pas d'API d'installation). Reportée 30 jours si le membre la ferme

## Stack technique

| Brique | Choix |
|---|---|
| Frontend | Angular 22 (standalone components, signals), PWA (`@angular/service-worker`) |
| Design system | [design-j6n](https://github.com/J-Dudek/design-j6n) (`theme.css` + `theme.js`) |
| Backend / BDD | Supabase (Postgres + Auth + Row Level Security + Realtime + Edge Functions + Vault) |
| Email transactionnel | Resend, via SMTP (emails d'auth) et API directe (notifications métier, appelée depuis Postgres via `pg_net`) |
| Hébergement frontend | Netlify |
| Tests | Vitest |

Aucun backend applicatif custom : le client Angular interroge directement Postgres via `@supabase/supabase-js`, et c'est **Row Level Security** qui fait toute l'autorisation. Les opérations qui nécessitent des privilèges élevés (inviter un compte, supprimer un compte, notifier les admins/passagers par email) passent par des **Edge Functions** ou des **fonctions SQL `security definer`** — jamais par la clé `service_role` côté client.

## Lancer le projet en local

**Prérequis** : Node.js 22+, npm, [Docker](https://docs.docker.com/get-docker/) (pour le stack Supabase local, ci-dessous).

### Démarrage rapide

```bash
npm run setup   # équivalent : node setup-local.mjs
```

Ce script (`setup-local.mjs`, à la racine du repo) fait tout en une seule commande, y compris pour un tout premier clone :
1. `npm install`, si `node_modules` n'existe pas encore
2. démarre le stack Supabase local (Docker) — migrations et seed rejoués automatiquement (voir [Backend local](#backend-local-supabase-cli) ci-dessous)
3. génère `src/environments/environment.development.ts` avec l'URL et la clé du stack local
4. crée `src/environments/environment.ts` avec ces mêmes valeurs locales s'il n'existe pas déjà — **il ne touche jamais un `environment.ts` déjà présent**, pour ne pas écraser les vraies valeurs de prod une fois configurées

```bash
npm start
```

→ [http://localhost:4200](http://localhost:4200), connecté au stack local, avec un compte admin déjà prêt : `admin@bazbazcar.local` / `password123`.

Les deux sous-sections suivantes détaillent ce que fait ce script — utile pour relancer une étape isolément, comprendre un message d'erreur, ou développer sans lui (par ex. directement contre le projet Supabase cloud).

### Backend local (Supabase CLI)

Pour développer et corriger des bugs sans jamais toucher à la base de **production**, le projet tourne en dev contre un stack Supabase complet (Postgres + Auth + Storage + Edge Functions + un attrape-mails) lancé en local via Docker par la CLI Supabase — installée comme `devDependency` du projet, pas besoin d'installation globale (voir `supabase/config.toml`).

```bash
npm run supabase:start   # démarre le stack (1er lancement : télécharge les images Docker, peut prendre plusieurs minutes)
```

Cette commande rejoue automatiquement, dans l'ordre, tout ce qu'elle trouve dans `supabase/` :
- `migrations/` — le même schéma + RLS + fonctions SQL qu'en prod
- `seed.sql` — un compte admin de démo déjà validé, pour se connecter sans étape manuelle : `admin@bazbazcar.local` / `password123` (ce fichier n'est joué qu'en local, jamais sur le projet distant)

À la fin du démarrage, la CLI affiche `API_URL`, `ANON_KEY`/`PUBLISHABLE_KEY` et `STUDIO_URL` — récupérables à tout moment avec `npm run supabase:status`. Studio (`http://127.0.0.1:54323`) donne une interface équivalente au dashboard Supabase Cloud pour inspecter les tables en local.

**Autres commandes utiles :**

```bash
npm run supabase:status     # réafficher URL/clés du stack local
npm run supabase:reset      # tout recréer depuis zéro (migrations + seed) — après une nouvelle migration
npm run supabase:stop       # arrêter les conteneurs Docker
npm run supabase:functions  # servir invite-membres/supprimer-mon-compte en local
npm run supabase:types      # régénérer les types TS depuis le schéma local
```

Les emails (confirmation, invitation, notifications) ne partent jamais réellement en local — ils sont interceptés et consultables dans l'attrape-mails de la CLI, à l'URL `MAILPIT_URL` affichée par `supabase status` (`http://127.0.0.1:54324` par défaut). Les notifications qui passent par le Vault (`resend_api_key`, cf. [Configurer l'envoi d'email](#5-configurer-lenvoi-demail-resend)) ne font simplement rien tant que ce secret n'existe pas — comportement voulu, pas une erreur.

### Connecter le frontend

Le [Démarrage rapide](#démarrage-rapide) ci-dessus le fait automatiquement — cette section détaille l'équivalent manuel. Le projet a besoin de deux fichiers, tous les deux ignorés par git :

```bash
cp src/environments/environment.template.ts src/environments/environment.ts
cp src/environments/environment.template.ts src/environments/environment.development.ts
```

`environment.development.ts` (dev quotidien, `npm start`) pointe vers le stack **local** — reprends les valeurs affichées par `supabase status` :

```ts
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseAnonKey: '<ANON_KEY ou PUBLISHABLE_KEY affichée par `supabase status`>',
};
```

`environment.ts` (utilisé par `npm run build`, prod) pointe vers le **vrai** projet Supabase :
- `supabaseUrl` — dashboard Supabase → **Project Settings → Data API**
- `supabaseAnonKey` — clé `anon` (legacy) ou publishable `sb_publishable_...` (recommandée) dans **Project Settings → API Keys**

(Tu peux aussi renseigner les valeurs cloud dans `environment.development.ts` pour développer directement contre le projet distant sans Docker — mais tu perds l'isolation vis-à-vis de la prod, qui est tout l'intérêt du stack local.)

**Lancer le serveur de dev :**

```bash
npm start
```

→ [http://localhost:4200](http://localhost:4200) (rechargement automatique à chaque modification).

**Autres commandes utiles :**

```bash
npm test              # tests unitaires (Vitest)
npm run build          # build de production dans dist/bazbazcar-app/browser
npm run watch          # build de dev en continu
```

Pour te connecter à l'application, il te faut un compte déjà validé — voir [Créer le premier compte administrateur](#4-créer-le-premier-compte-administrateur) ci-dessous.

## Qualité de code — lint, format, accessibilité

```bash
npm run lint          # ESLint (TypeScript + templates) — inclut Prettier et l'accessibilité (RGAA, cf. ci-dessous)
npm run lint:rgaa     # Seulement les règles d'accessibilité, isolément (ex. étape dédiée en CI)
npm run dev            # ng serve + relance du lint à chaque modification, dans le même terminal
```

**ESLint + Prettier unifiés** (`eslint.config.js`) : les écarts de formatage remontent comme des erreurs ESLint (`prettier/prettier`, via `eslint-plugin-prettier`) — un seul rapport, pas deux outils à faire tourner séparément.

**Accessibilité (RGAA)** (`eslint.rgaa.config.js`) : il n'existe pas de plugin ESLint "RGAA" — le RGAA est un référentiel d'audit, pas un outil automatisé. Cette configuration regroupe les règles d'accessibilité d'`angular-eslint` (alternative textuelle, labels de formulaire, ARIA, équivalents clavier, en-têtes de tableau...), qui couvrent la partie des critères RGAA détectable statiquement dans un template ; le fichier documente en commentaire la correspondance indicative avec les thématiques RGAA et rappelle ce qu'un lint ne peut pas couvrir (contraste des couleurs, ordre du focus, alternatives aux médias temporels, cohérence de navigation...) — pour un audit RGAA complet, voir l'outil officiel [Ara](https://github.com/DISIC/Ara) (DISIC). Ces mêmes règles sont aussi actives par défaut dans `npm run lint` ; `lint:rgaa` permet de les lancer isolément.

**Retour en direct pendant le dev** :
- **Éditeur (VS Code)** : ouvrir le projet avec les extensions recommandées (`.vscode/extensions.json` — ESLint + Prettier) donne un retour immédiat en tapant (soulignés, panneau *Problems*) et corrige automatiquement au `save` (`.vscode/settings.json`).
- **Terminal** : `npm run dev` lance `ng serve` et un watcher lint (`npm run lint:watch`, via `chokidar`) en parallèle dans le même terminal, avec un préfixe de couleur par flux.

## Reproduire le projet avec d'autres comptes

Cette section explique comment relancer entièrement le projet (frontend + backend + emails) avec de nouveaux comptes Supabase/Resend/Netlify — utile pour un fork, une migration, ou un environnement de test séparé.

### 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), crée un nouveau projet (choisis une région proche de tes utilisateurs, ex. `eu-west-1` pour la France).
2. Note l'**URL du projet** et la **clé publishable** (Project Settings → API Keys) — tu en auras besoin pour `environment.ts` et pour Netlify.

### 2. Appliquer le schéma (migrations SQL)

Toutes les migrations sont versionnées dans `supabase/migrations/`, numérotées et à appliquer **dans l'ordre**. Deux façons de faire :

**Avec la Supabase CLI (recommandé) :**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <ton-project-ref>
supabase db push
```

**Sans la CLI :** ouvre le **SQL Editor** du dashboard Supabase et exécute le contenu de chaque fichier de `supabase/migrations/`, du plus ancien au plus récent (`0001_schema.sql` → `0017_notification_nouvel_evenement.sql`).

### 3. Déployer les Edge Functions

Deux fonctions serveur, dans `supabase/functions/` :
- `invite-membres` — invite un ou plusieurs comptes par email (privilège admin)
- `supprimer-mon-compte` — supprime le compte de l'appelant (avec garde-fou : pas de suppression si c'est le seul admin)

```bash
supabase functions deploy invite-membres
supabase functions deploy supprimer-mon-compte
```

Aucun secret à configurer manuellement pour ces fonctions : `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées automatiquement par Supabase dans chaque Edge Function.

### 4. Créer le premier compte administrateur

Il n'existe volontairement aucun moyen de devenir admin depuis l'interface (voir `CLAUDE.md` §4). Après avoir créé ton compte normalement via le formulaire d'inscription :

```sql
update public.profiles
set role = 'admin', statut = 'valide'
where email = 'ton-email@exemple.fr';
```

À exécuter dans le **SQL Editor** du dashboard Supabase.

### 5. Configurer l'envoi d'email (Resend)

Le fournisseur d'email intégré de Supabase est limité (quelques emails/heure, destinataires restreints) — il faut un SMTP personnalisé pour un usage réel.

1. Crée un compte sur [resend.com](https://resend.com) et génère une clé API (**API Keys**).
2. **Vérifie ton domaine** (**Domains** → ajoute les enregistrements DNS fournis) — indispensable pour envoyer à n'importe quel destinataire (en mode non-vérifié, Resend n'autorise l'envoi qu'à l'adresse du propriétaire du compte).
3. Dans le dashboard Supabase → **Authentication → Emails → SMTP Settings** : active *Enable Custom SMTP* et renseigne :
   - Sender email : une adresse sur ton domaine vérifié (ex. `no-reply@tondomaine.fr`)
   - Host : `smtp.resend.com`
   - Port : `465` (SSL) ou `587` (TLS)
   - Username : `resend`
   - Password : ta clé API Resend
4. Dans **Authentication → URL Configuration**, ajoute l'URL de ton site (Netlify ou localhost pour les tests) à la liste **Redirect URLs** — nécessaire pour que les liens de confirmation, réinitialisation de mot de passe et invitation fonctionnent.
5. Enregistre la même clé API Resend dans le **Vault** Supabase (utilisée par les notifications automatiques — nouveau compte à valider, trajet annulé) :

```sql
select vault.create_secret('re_ta_cle_resend', 'resend_api_key');
```

Le nom `resend_api_key` doit rester exactement celui-ci, c'est ce que les fonctions SQL (`notifier_admins_nouveau_compte`, `notifier_passagers_annulation_trajet`, `notifier_membres_nouvel_evenement`) vont chercher.

### 6. Configurer le frontend

Voir [Lancer le projet en local](#lancer-le-projet-en-local) ci-dessus pour `environment.ts`/`environment.development.ts`, avec l'URL et la clé du **nouveau** projet Supabase.

### 7. Déployer sur Netlify

Voir [Déploiement](#déploiement) ci-dessous.

## Variables d'environnement — récapitulatif

| Où | Quoi | Valeur | Comment |
|---|---|---|---|
| Stack Supabase local (Docker) | — | Générées automatiquement, aucun compte à créer | Affichées par `npm run supabase:status` |
| Local (`src/environments/environment.ts` et `.development.ts`) | `supabaseUrl`, `supabaseAnonKey` | URL + clé publique du stack local (dev) ou du projet Supabase cloud (build prod) | Fichiers **gitignorés**, créés à la main depuis `environment.template.ts` |
| Netlify (Site settings → Environment variables) | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Idem | Injectées au build par `scripts/generate-environment.mjs` (voir `netlify.toml`) |
| GitHub Actions (si CI ajoutée plus tard — Settings → Secrets and variables → Actions) | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Idem | Uniquement nécessaire si un workflow build/teste le projet ; le déploiement lui-même passe par l'intégration Git native de Netlify, pas par GitHub Actions |
| Supabase — secrets Edge Functions | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | — | **Injectées automatiquement** par Supabase, rien à faire |
| Supabase — Vault (SQL) | `resend_api_key` | Clé API Resend | `select vault.create_secret('...', 'resend_api_key');` dans le SQL Editor |
| Supabase — Auth SMTP (dashboard) | Host/port/user/password Resend | — | **Authentication → Emails → SMTP Settings** |

**Ce qui ne doit jamais apparaître dans le repo** : la clé `service_role` Supabase, la clé API Resend, tout mot de passe. Le `.gitignore` exclut déjà les fichiers `environment*.ts` générés — avant chaque commit, un coup d'œil au diff sur ces zones reste une bonne habitude.

## Déploiement

Le déploiement passe par l'intégration Git native de Netlify (pas de GitHub Actions nécessaire) :

1. Pousse le repo sur GitHub (ou GitLab/Bitbucket)
2. Sur [netlify.com](https://netlify.com), crée un site en le liant à ce repo — `netlify.toml` est détecté automatiquement (build command et dossier de publication déjà configurés)
3. Renseigne les variables d'environnement du site (**Site settings → Environment variables**) :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Déploie — chaque build exécute `npm run build:netlify`, qui génère `src/environments/environment.ts` à partir de ces variables puis lance `ng build`

Chaque push sur la branche configurée redéploie automatiquement.

**Domaine personnalisé** : à configurer dans Netlify (**Domain management**) une fois un nom de domaine choisi — pense à ajouter l'URL finale du site dans **Redirect URLs** côté Supabase Auth, et à mettre à jour le "Sender email" du SMTP si tu changes de domaine.

## Structure du projet

```
src/app/
  core/
    auth/            # service Auth (wrapper supabase-js) + guards de route
    supabase/         # client Supabase singleton
    theme/            # thème clair/sombre/auto
  features/
    inscription/       # inscription + écran "en attente de validation"
    connexion/          # connexion, mot de passe oublié/nouveau
    accueil/             # page d'accueil post-connexion
    evenements/           # liste, détail, trajets, commentaires
    admin/                 # création d'événements, invitations, membres, statistiques
    compte/                 # gestion de son propre compte
  shared/
    ui/                # composants réutilisables (header, sélecteur de thème)
    models/            # interfaces TS
supabase/
  migrations/          # schéma + RLS + fonctions SQL, numérotées et appliquées dans l'ordre
  functions/            # Edge Functions (invite-membres, supprimer-mon-compte)
```
