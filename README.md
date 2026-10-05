# bazbazcar — template de covoiturage associatif

Application de covoiturage clé en main pour une association loi 1901 : les membres proposent et rejoignent des trajets vers les événements créés par les administrateurs. Angular (standalone components, signals) côté client, Supabase (Postgres, Auth, Row Level Security, Realtime, Edge Functions) côté serveur, [design-j6n](https://github.com/J-Dudek/design-j6n) pour l'UI. Pas de backend applicatif custom — voir [Stack technique](#stack-technique).

**Ce dépôt est pensé comme un template.** `bazbazcar` est l'instance de référence ; pour l'adapter à ton association, il suffit de remplacer **le nom** et **le logo**, puis de brancher tes propres comptes Supabase / Resend / Netlify. Aucune ligne de logique métier à toucher.

> 👉 Parcours complet : [Utiliser ce projet comme template](#utiliser-ce-projet-comme-template) (une commande + tes visuels) → [Mettre en ligne pour ton association](#mettre-en-ligne-pour-ton-association) (comptes et déploiement, ~1 h).

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Utiliser ce projet comme template](#utiliser-ce-projet-comme-template)
- [Stack technique](#stack-technique)
- [Lancer le projet en local](#lancer-le-projet-en-local)
- [Qualité de code — lint, format, accessibilité](#qualité-de-code--lint-format-accessibilité)
- [Mettre en ligne pour ton association](#mettre-en-ligne-pour-ton-association)
- [Variables d'environnement — récapitulatif](#variables-denvironnement--récapitulatif)
- [Déploiement](#déploiement)
- [Structure du projet](#structure-du-projet)

## Fonctionnalités

**Comptes & authentification**
- Inscription email + mot de passe, confirmation par email
- Connexion, mot de passe oublié, changement de mot de passe, suppression de compte (`/mon-compte`)
- Statut `en_attente` par défaut : validation manuelle par un administrateur requise avant de proposer ou rejoindre un trajet
- Invitation directe par un admin, avec choix du rôle — compte pré-validé, mot de passe défini par l'invité via le lien reçu
- Email automatique aux admins à chaque nouveau compte en attente de validation

**Événements & trajets**
- Liste triée par proximité : événements à venir en premier (le plus proche d'abord), puis événements passés (le plus récent d'abord), avec badge « Terminé » sur ces derniers
- Création et modification d'un événement réservées aux admins
- Un événement passé passe en lecture seule côté trajets : plus de création, inscription, désinscription, modification ni suppression, y compris pour un admin — seul l'événement lui-même reste modifiable (RLS + fonctions SQL, pas un simple masquage frontend)
- Proposition d'un trajet par tout membre validé (adresse de départ, horaire, nombre de places, contact facultatif)
- Inscription et désinscription avec décompte transactionnel des places (fonctions SQL `security definer`, jamais d'update direct depuis le client — pas de race condition possible)
- Liste des passagers inscrits visible sur chaque trajet
- Annulation d'un trajet par son conducteur, avec notification email automatique aux passagers inscrits
- Commentaires par événement — écriture réservée aux admins, lecture ouverte à tout membre validé
- Notification temps réel (Supabase Realtime) aux membres déjà connectés à la publication d'un nouvel événement, en complément de l'email

**Espace admin**
- Gestion des comptes : rôle (membre/admin) et statut (en attente/validé/refusé) de n'importe quel membre
- Statistiques par membre : places proposées, trajets rejoints
- Garde-fou : impossible de supprimer le dernier compte admin

**PWA**
- Thème clair/sombre/automatique, persistant par appareil
- Installable : prompt natif sur Chrome/Edge/Android, mode d'emploi dédié sur iOS (Safari n'expose aucune API d'installation) ; proposition différée 30 jours après un refus
- Détection de nouvelle version en tâche de fond, avec invite à recharger plutôt qu'un rechargement forcé — pour ne pas perdre un formulaire en cours de saisie

## Utiliser ce projet comme template

### 1. Récupérer le code

Sur GitHub : bouton **Use this template → Create a new repository** (ou un fork), puis cloner ton nouveau dépôt. L'historique de `bazbazcar` n'est pas nécessaire.

### 2. Remplacer le nom et le slogan — `npm run init-template`

```bash
npm run init-template
```

Le script pose trois questions et fait tout le « rechercher / remplacer » à ta place :

| Question | Exemple | Où ça va |
|---|---|---|
| **Identifiant technique** — minuscules, chiffres, tirets | `covoitjazz` | package npm, projet Angular, dossier de build Netlify, `project_id` Supabase local, compte de démo `admin@covoitjazz.local` |
| **Nom affiché** — majuscules, espaces, apostrophes permises | `Covoit' Jazz` | onglet, header, popin d'installation, manifeste PWA, emails d'authentification et de notification |
| **Slogan** — facultatif | `le covoiturage du jazz club` | `og:title`/`og:description`, manifeste PWA, `<title>` du logo SVG |

Le nom affiché est échappé selon le format de chaque fichier (apostrophes doublées en SQL, JSON valide dans le manifeste…). Les caractères `< > & "` sont refusés.

- **Prévisualiser** sans rien écrire : `npm run init-template -- --dry-run`
- **Sans questions** (CI, script) : `node scripts/init-template.mjs --id covoitjazz --nom "Covoit' Jazz" --slogan "le covoiturage du jazz club"`
- **Une seule fois** : le script s'arrête s'il ne trouve plus `bazbazcar`, signe que le template est déjà initialisé. Pour recommencer : `git checkout .` puis relancer.

> ⚠️ Le script **modifie les migrations SQL** (textes des emails de notification). C'est sans risque sur un projet Supabase **neuf**, où elles seront jouées pour la première fois, mais **ne jamais le lancer sur une instance déjà en production**. Là, tout changement passe par une **nouvelle** migration qui redéfinit les fonctions concernées.

Le README n'est pas réécrit (il continue de décrire l'instance de référence), à l'exception de l'adresse du compte de démo.

### 3. Remplacer le logo

Tous les visuels sont dans `public/` ; garder **les mêmes noms de fichiers et dimensions**, aucune référence de code n'est alors à modifier.

| Fichier | Dimensions | Usage |
|---|---|---|
| `logo.svg` | libre (ratio ≈ 0,9 : 1 conseillé) | logo du header et filigrane en fond de page |
| `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png` | 16 / 16 / 32 / 48 px | onglet du navigateur |
| `apple-touch-icon.png` | 180 × 180 | écran d'accueil iOS |
| `android-chrome-192x192.png`, `android-chrome-512x512.png` | 192 / 512 px | icônes PWA (Android, Chrome, Edge) |
| `maskable-icon-512.png` | 512 × 512, logo dans le cercle central (~80 %) | icône PWA adaptative Android — vérifier sur [maskable.app](https://maskable.app) |
| `og-image.jpg` | 1200 × 630 | aperçu lors d'un partage de lien (WhatsApp, réseaux sociaux…) |

`logo-256/512/1024.png` et `logo_circle_transparent.png` ne sont référencés nulle part : ce sont les sources ayant servi à générer les icônes, à remplacer ou supprimer librement. Un générateur comme [realfavicongenerator.net](https://realfavicongenerator.net) produit l'essentiel du jeu d'icônes à partir d'une seule image.

Si la largeur/hauteur du logo change sensiblement, ajuster `width`/`height` de l'`<img class="brand-logo">` dans `src/app/shared/ui/header.html`.

### 4. (Optionnel) Couleurs

- **Interface** : le thème vient de [design-j6n](https://github.com/J-Dudek/design-j6n) (variables `--j6n-*`) ; les surcharger dans `src/styles.css` plutôt que de modifier la librairie.
- **Barre du navigateur / écran de lancement PWA** : `theme-color` dans `src/index.html`, `theme_color` et `background_color` dans `public/site.webmanifest`.
- **Emails** : couleurs codées en dur (styles inline, imposés par les clients mail) dans `supabase/templates/*.html`.

### 5. Vérifier

```bash
npm run setup && npm start
```

Contrôler l'onglet, le header, le filigrane, la popin d'installation, puis un email de confirmation dans Mailpit (`http://127.0.0.1:54324`). Une fois satisfait : [Mettre en ligne pour ton association](#mettre-en-ligne-pour-ton-association).

## Stack technique

| Brique | Choix |
|---|---|
| Frontend | Angular 22 (standalone components, signals), PWA (`@angular/service-worker`) |
| Design system | [design-j6n](https://github.com/J-Dudek/design-j6n) (`theme.css` + `theme.js`) |
| Backend / BDD | Supabase (Postgres + Auth + Row Level Security + Realtime + Edge Functions + Vault) |
| Email transactionnel | Resend, via SMTP (emails d'auth) et API directe (notifications métier, appelée depuis Postgres via `pg_net`) |
| Hébergement frontend | Netlify |
| Tests | Vitest |

Le client Angular interroge directement Postgres via `@supabase/supabase-js` ; l'autorisation est entièrement déléguée aux policies **Row Level Security**, jamais à un filtre côté frontend. Les opérations qui nécessitent des privilèges élevés (inviter un compte, supprimer un compte, notifier par email) passent par des **Edge Functions** ou des **fonctions SQL `security definer`** — la clé `service_role` ne quitte jamais le serveur.

## Lancer le projet en local

**Prérequis** : Node.js 22+, npm, [Docker](https://docs.docker.com/get-docker/) (stack Supabase local).

### Démarrage rapide

```bash
npm run setup   # équivalent : node setup-local.mjs
npm start
```

`setup-local.mjs` enchaîne, en une commande et dès le premier clone :
1. `npm install`, si `node_modules` n'existe pas encore
2. démarrage du stack Supabase local (Docker), migrations et seed rejoués automatiquement — détail dans [Backend local](#backend-local-supabase-cli)
3. génération de `src/environments/environment.development.ts` avec l'URL et la clé du stack local
4. création de `src/environments/environment.ts` avec ces mêmes valeurs locales s'il n'existe pas déjà — un `environment.ts` existant n'est jamais écrasé, pour ne pas remplacer des valeurs de prod déjà configurées

L'app tourne ensuite sur [http://localhost:4200](http://localhost:4200), connectée au stack local, avec un compte admin de démo prêt à l'emploi : `admin@bazbazcar.local` / `password123`.

Les deux sous-sections suivantes détaillent ce que fait ce script — utile pour relancer une étape isolément, diagnostiquer une erreur, ou travailler sans lui (par exemple directement contre le projet Supabase cloud).

### Backend local (Supabase CLI)

Le développement se fait contre un stack Supabase complet (Postgres + Auth + Storage + Edge Functions + un attrape-mails) lancé en local via Docker par la Supabase CLI, installée en `devDependency` — aucune installation globale requise (voir `supabase/config.toml`).

```bash
npm run supabase:start   # 1er lancement : télécharge les images Docker, peut prendre plusieurs minutes
```

Cette commande rejoue automatiquement, dans l'ordre, tout ce qu'elle trouve dans `supabase/` :
- `migrations/` — le même schéma, les mêmes policies RLS et les mêmes fonctions SQL qu'en production
- `seed.sql` — un compte admin de démo déjà validé (`admin@bazbazcar.local` / `password123`), rejoué uniquement en local, jamais sur le projet distant

À la fin du démarrage, la CLI affiche `API_URL`, `ANON_KEY`/`PUBLISHABLE_KEY` et `STUDIO_URL`, récupérables à tout moment avec `npm run supabase:status`. Studio (`http://127.0.0.1:54323`) donne une interface équivalente au dashboard Supabase Cloud pour inspecter les tables en local.

**Autres commandes utiles :**

```bash
npm run supabase:status     # réafficher URL/clés du stack local
npm run supabase:reset      # tout recréer depuis zéro (migrations + seed) — après une nouvelle migration
npm run supabase:stop       # arrêter les conteneurs Docker
npm run supabase:functions  # servir invite-membres/supprimer-mon-compte en local
npm run supabase:types      # régénérer les types TS depuis le schéma local
```

Les emails (confirmation, invitation, notifications) ne partent jamais réellement en local : ils sont interceptés et consultables dans l'attrape-mails de la CLI, à l'URL `MAILPIT_URL` affichée par `supabase status` (`http://127.0.0.1:54324` par défaut). Les notifications qui passent par le Vault (`resend_api_key`, voir [Configurer l'envoi d'email](#5-configurer-lenvoi-demail-resend)) sont simplement silencieuses tant que ce secret n'existe pas — comportement attendu, pas une erreur.

### Connecter le frontend

Le [Démarrage rapide](#démarrage-rapide) ci-dessus fait tout ça automatiquement — cette section détaille l'équivalent manuel. Le projet a besoin de deux fichiers, tous les deux ignorés par git :

```bash
cp src/environments/environment.template.ts src/environments/environment.ts
cp src/environments/environment.template.ts src/environments/environment.development.ts
```

`environment.development.ts` (dev quotidien, `npm start`) pointe vers le stack **local** — reprendre les valeurs affichées par `supabase status` :

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

Il est aussi possible de renseigner les valeurs cloud dans `environment.development.ts`, pour développer directement contre le projet distant sans Docker — au prix de l'isolation vis-à-vis de la prod, qui est tout l'intérêt du stack local.

**Lancer le serveur de dev :**

```bash
npm start
```

→ [http://localhost:4200](http://localhost:4200), rechargement automatique à chaque modification.

**Autres commandes utiles :**

```bash
npm test               # tests unitaires (Vitest)
npm run build          # build de production dans dist/<identifiant>-app/browser
npm run watch          # build de dev en continu
```

Se connecter à l'application nécessite un compte déjà validé — voir [Créer le premier compte administrateur](#4-créer-le-premier-compte-administrateur) ci-dessous.

## Qualité de code — lint, format, accessibilité

```bash
npm run lint          # ESLint (TypeScript + templates) — inclut Prettier et l'accessibilité (RGAA, cf. ci-dessous)
npm run lint:rgaa     # règles d'accessibilité seules, isolément (ex. étape dédiée en CI)
npm run dev           # ng serve + relance du lint à chaque modification, dans le même terminal
```

**ESLint + Prettier unifiés** (`eslint.config.js`) : les écarts de formatage remontent comme des erreurs ESLint (`prettier/prettier`, via `eslint-plugin-prettier`) — un seul rapport, pas deux outils à faire tourner séparément.

**Accessibilité (RGAA)** (`eslint.rgaa.config.js`) : il n'existe pas de plugin ESLint « RGAA » à proprement parler, le RGAA étant un référentiel d'audit et non un outil automatisé. Cette configuration regroupe les règles d'accessibilité d'`angular-eslint` (alternative textuelle, labels de formulaire, ARIA, équivalents clavier, en-têtes de tableau…), qui couvrent la part des critères RGAA détectable statiquement dans un template. Le fichier documente en commentaire la correspondance indicative avec les thématiques RGAA et rappelle ce qu'un lint ne peut pas couvrir (contraste des couleurs, ordre du focus, alternatives aux médias temporels, cohérence de navigation…). Pour un audit RGAA complet, voir l'outil officiel [Ara](https://github.com/DISIC/Ara) (DISIC). Ces règles sont actives par défaut dans `npm run lint` ; `lint:rgaa` permet de les lancer isolément.

**Retour en direct pendant le dev** :
- **Éditeur (VS Code)** : ouvrir le projet avec les extensions recommandées (`.vscode/extensions.json` — ESLint + Prettier) donne un retour immédiat en tapant (soulignés, panneau *Problems*) et corrige automatiquement à l'enregistrement (`.vscode/settings.json`).
- **Terminal** : `npm run dev` lance `ng serve` et un watcher lint (`npm run lint:watch`, via `chokidar`) en parallèle dans le même terminal, avec un préfixe de couleur par flux.

## Mettre en ligne pour ton association

Cette section explique comment lancer ta propre instance (frontend + backend + emails) avec tes comptes Supabase/Resend/Netlify — tous utilisables en offre gratuite pour une association de taille modeste. À faire **après** la [personnalisation](#utiliser-ce-projet-comme-template). Valable aussi pour une migration ou un environnement de test séparé.

### 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créer un nouveau projet (choisir une région proche des utilisateurs, ex. `eu-west-1` pour la France).
2. Noter l'**URL du projet** et la **clé publishable** (Project Settings → API Keys) — nécessaires pour `environment.ts` et pour Netlify.

### 2. Appliquer le schéma (migrations SQL)

Toutes les migrations sont versionnées dans `supabase/migrations/`, numérotées et à appliquer **dans l'ordre**. Deux façons de faire :

**Avec la Supabase CLI (recommandé) :**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <ton-project-ref>
supabase db push
```

**Sans la CLI :** ouvrir le **SQL Editor** du dashboard Supabase et exécuter le contenu de chaque fichier de `supabase/migrations/`, du plus ancien au plus récent.

### 3. Déployer les Edge Functions

Deux fonctions serveur, dans `supabase/functions/` :
- `invite-membres` — invite un ou plusieurs comptes par email (privilège admin)
- `supprimer-mon-compte` — supprime le compte de l'appelant, avec garde-fou (pas de suppression si c'est le seul admin)

```bash
supabase functions deploy invite-membres
supabase functions deploy supprimer-mon-compte
```

Aucun secret à configurer manuellement pour ces fonctions : `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées automatiquement par Supabase dans chaque Edge Function.

### 4. Créer le premier compte administrateur

Il n'existe volontairement aucun moyen de devenir admin depuis l'interface (voir `CLAUDE.md` §4). Après avoir créé un compte normalement via le formulaire d'inscription :

```sql
update public.profiles
set role = 'admin', statut = 'valide'
where email = 'ton-email@exemple.fr';
```

À exécuter dans le **SQL Editor** du dashboard Supabase.

### 5. Configurer l'envoi d'email (Resend)

Le fournisseur d'email intégré de Supabase est limité (quelques emails/heure, destinataires restreints) — un SMTP personnalisé est nécessaire pour un usage réel.

1. Créer un compte sur [resend.com](https://resend.com) et générer une clé API (**API Keys**).
2. **Vérifier le domaine d'envoi** (**Domains** → ajouter les enregistrements DNS fournis) — indispensable pour envoyer à n'importe quel destinataire (en mode non vérifié, Resend n'autorise l'envoi qu'à l'adresse du propriétaire du compte).
3. Dans le dashboard Supabase → **Authentication → Emails → SMTP Settings** : activer *Enable Custom SMTP* et renseigner :
   - Sender email : une adresse sur le domaine vérifié (ex. `no-reply@tondomaine.fr`)
   - Host : `smtp.resend.com`
   - Port : `465` (SSL) ou `587` (TLS)
   - Username : `resend`
   - Password : la clé API Resend
4. Dans **Authentication → URL Configuration**, ajouter l'URL du site (Netlify ou localhost pour les tests) à la liste **Redirect URLs** — nécessaire pour que les liens de confirmation, réinitialisation de mot de passe et invitation fonctionnent.
5. Enregistrer la même clé API Resend dans le **Vault** Supabase, utilisée par les notifications automatiques (nouveau compte à valider, compte activé, trajet annulé, nouvel événement) :

```sql
select vault.create_secret('re_ta_cle_resend', 'resend_api_key');
```

Le nom `resend_api_key` doit rester exactement celui-ci : c'est ce que les fonctions SQL (`notifier_admins_nouveau_compte`, `notifier_membre_compte_active`, `notifier_passagers_annulation_trajet`, `notifier_membres_nouvel_evenement`) vont y chercher.

Ces fonctions envoient un email par destinataire (jamais d'adresses visibles entre membres), via l'endpoint `/emails/batch` de Resend — 100 emails par requête, découpés automatiquement au-delà. Tout texte saisi par un utilisateur (nom, adresse, titre…) est échappé avant d'être inséré dans le HTML (`echapper_html`).

6. Enregistrer l'adresse d'expéditeur des notifications dans le Vault, avec **le même domaine vérifié** que le SMTP de l'étape 3 :

```sql
select vault.create_secret('Nom de ton asso <notifications@tondomaine.fr>', 'email_expediteur');
```

Sans ce secret, les notifications partent de `onboarding@resend.dev` (expéditeur de test de Resend) : domaine partagé, non aligné sur celui du site, donc spam quasi garanti — à réserver au dev.

#### Emails en spam : par où commencer

Ouvrir un message classé en spam → **Afficher l'original** (Gmail). Les lignes `SPF`, `DKIM` et `DMARC` doivent être en `PASS`, et le domaine du `From` doit être celui vérifié chez Resend. Ce qui échoue indique quoi corriger :

- **SPF ou DKIM en `FAIL`/absent** : le domaine n'est pas (ou mal) vérifié — dans Resend → **Domains**, tous les enregistrements DNS doivent être au vert.
- **DMARC absent** : ajouter un enregistrement TXT `_dmarc.tondomaine.fr` avec `v=DMARC1; p=none; rua=mailto:toi@tondomaine.fr` (à durcir plus tard).
- **`From` en `resend.dev`, `gmail.com` ou un autre domaine** : corriger le *Sender email* du SMTP Supabase (étape 3) et le secret `email_expediteur` (étape 6).
- **Tout est en `PASS` mais ça finit quand même en spam** : domaine récent sans réputation (les premiers envois sont les pires — demander aux membres de marquer « Pas un spam »), suivi des clics/ouvertures activé côté Resend (à désactiver), ou gabarits Auth par défaut (voir ci-dessous).

#### Gabarits des emails d'authentification

Les gabarits par défaut de Supabase sont en anglais, avec un objet générique et un simple lien (« Reset your password… ») : un modèle très courant dans le phishing, que Gmail classe volontiers en spam (« semblable à des messages identifiés comme spam par le passé »), surtout depuis un domaine récent. Des versions françaises, avec le nom de l'app et une explication, sont dans `supabase/templates/` :

| Fichier | Dashboard (**Authentication → Emails → Templates**) | Objet à saisir |
|---|---|---|
| `confirmation.html` | Confirm sign up | `Confirme ton adresse email — <nom de l'app>` |
| `recovery.html` | Reset password | `Réinitialise ton mot de passe — <nom de l'app>` |
| `invite.html` | Invite user | `Invitation à rejoindre <nom de l'app>` |

Les objets à jour sont aussi dans `supabase/config.toml` (sections `[auth.email.template.*]`). Pour chacun : coller le contenu du fichier dans *Message body* (mode source) et l'objet ci-dessus dans *Subject heading*, puis enregistrer. Tester immédiatement avec « Mot de passe oublié » sur son propre compte. Ces mêmes fichiers sont référencés dans `supabase/config.toml`, donc le stack local (Mailpit) les utilise après un `npm run supabase:stop && npm run supabase:start`.

> ⚠️ Ne pas utiliser `supabase config push` pour les publier : la commande applique **toute** la config Auth de `config.toml` (dont `site_url` et les redirections, réglés pour le local) au projet distant, pas seulement les gabarits.

Le pied de page des gabarits pointe vers `{{ .SiteURL }}` : vérifier que **Authentication → URL Configuration → Site URL** est bien l'URL de production. N'y ajouter aucune donnée saisie par l'utilisateur (`{{ .Data.prenom }}`, `{{ .Email }}`…) sans s'assurer qu'elle est échappée, pour la même raison que dans les notifications.

Régler aussi le **Sender name** du SMTP (**Authentication → Emails → SMTP Settings**) sur le nom de l'app : un expéditeur affiché sous un autre nom que celui que le membre connaît lui paraît inconnu, et les filtres antispam aussi.

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
| GitHub Actions (si CI ajoutée plus tard — Settings → Secrets and variables → Actions) | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Idem | Nécessaire seulement si un workflow build/teste le projet ; le déploiement lui-même passe par l'intégration Git native de Netlify, pas par GitHub Actions |
| Supabase — secrets Edge Functions | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | — | **Injectées automatiquement** par Supabase, rien à faire |
| Supabase — Vault (SQL) | `resend_api_key` | Clé API Resend | `select vault.create_secret('...', 'resend_api_key');` dans le SQL Editor |
| Supabase — Vault (SQL) | `email_expediteur` | Expéditeur des notifications, ex. `Nom de ton asso <notifications@tondomaine.fr>` (domaine vérifié chez Resend) | `select vault.create_secret('...', 'email_expediteur');` dans le SQL Editor |
| Supabase — Auth SMTP (dashboard) | Host/port/user/password Resend | — | **Authentication → Emails → SMTP Settings** |

**Ce qui ne doit jamais apparaître dans le repo** : la clé `service_role` Supabase, la clé API Resend, tout mot de passe. Le `.gitignore` exclut déjà les fichiers `environment*.ts` générés — un coup d'œil au diff sur ces zones avant chaque commit reste une bonne habitude.

## Déploiement

Le déploiement passe par l'intégration Git native de Netlify, sans GitHub Actions :

1. Pousser le repo sur GitHub (ou GitLab/Bitbucket)
2. Sur [netlify.com](https://netlify.com), créer un site en le liant à ce repo — `netlify.toml` est détecté automatiquement (build command et dossier de publication déjà configurés)
3. Renseigner les variables d'environnement du site (**Site settings → Environment variables**) :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Déployer — chaque build exécute `npm run build:netlify`, qui génère `src/environments/environment.ts` à partir de ces variables puis lance `ng build`

Chaque push sur la branche configurée redéploie automatiquement.

**Domaine personnalisé** : à configurer dans Netlify (**Domain management**) une fois un nom de domaine choisi — penser à ajouter l'URL finale du site dans **Redirect URLs** côté Supabase Auth, et à mettre à jour le *Sender email* du SMTP en cas de changement de domaine.

## Structure du projet

```
src/app/
  core/
    auth/              # service Auth (wrapper supabase-js) + guards de route
    membres/            # compteur de comptes en attente de validation (badge header)
    pwa/                 # installation et détection de mise à jour du service worker
    supabase/             # client Supabase singleton
    theme/                 # thème clair/sombre/auto
  features/
    inscription/       # inscription + écran "en attente de validation"
    connexion/           # connexion, mot de passe oublié/nouveau
    accueil/               # page d'accueil post-connexion
    evenements/              # liste, détail, trajets, commentaires
    admin/                     # création d'événements, invitations, membres, statistiques
    compte/                     # gestion de son propre compte
  shared/
    ui/                # header, popins (installation PWA, nouvel événement), sélecteur de thème
    models/            # interfaces TS
supabase/
  migrations/          # schéma + RLS + fonctions SQL, numérotées et appliquées dans l'ordre
  functions/            # Edge Functions (invite-membres, supprimer-mon-compte)
```
