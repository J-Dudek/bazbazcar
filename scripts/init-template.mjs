#!/usr/bin/env node
// Personnalise le template pour une nouvelle association, en une commande :
// remplace le nom de l'instance de référence (« bazbazcar ») et son slogan
// dans tout le dépôt. À lancer une seule fois, juste après avoir récupéré le
// code et AVANT la première mise en ligne (les migrations SQL sont modifiées :
// ce n'est valable que sur un projet Supabase qui ne les a jamais jouées).
//
// Le nom existe sous deux formes, traitées différemment :
// - l'identifiant technique (minuscules, chiffres, tirets) : package npm,
//   projet Angular, dossier de build Netlify, project_id Supabase local,
//   compte de démo ;
// - le nom affiché (majuscules, espaces, apostrophes permises) : header,
//   titre de l'onglet, manifeste PWA, emails. Il est échappé selon le format
//   du fichier (SQL, JSON) — d'où l'interdiction de < > & " qui
//   demanderaient un échappement HTML différent selon le contexte.
//
// Usage :
//   npm run init-template                       (questions interactives)
//   node scripts/init-template.mjs --id covoitjazz --nom "Covoit' Jazz" \
//     --slogan "le covoiturage du jazz club" [--dry-run]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const ANCIEN_NOM = 'bazbazcar';
const ANCIEN_SLOGAN = 'le covoiturage musical';
const ANCIENNE_DESCRIPTION = "Le covoiturage musical de l'association.";

const root = fileURLToPath(new URL('..', import.meta.url));
const DOSSIERS_EXCLUS = new Set(['node_modules', '.git', 'dist', '.angular', '.idea']);
// Ni ce script (il contient l'ancien nom par construction), ni le README
// (il documente l'instance de référence) — à part le compte de démo, cf. plus bas.
const FICHIERS_EXCLUS = new Set(['scripts/init-template.mjs', 'README.md']);

// Fichiers où le nom est un identifiant technique, jamais affiché.
const FICHIERS_TECHNIQUES = new Set([
  'package.json',
  'package-lock.json',
  'angular.json',
  'netlify.toml',
  'setup-local.mjs',
  'supabase/seed.sql',
]);

const { values: options } = parseArgs({
  options: {
    id: { type: 'string' },
    nom: { type: 'string' },
    slogan: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

function erreur(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function validerId(id) {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(id)) {
    return 'identifiant invalide : minuscules, chiffres et tirets uniquement, en commençant par une lettre (ex. covoitjazz).';
  }
  if (id === ANCIEN_NOM) return `l'identifiant doit être différent de « ${ANCIEN_NOM} ».`;
  return null;
}

function validerTexte(texte, champ) {
  if (!texte.trim()) return `${champ} vide.`;
  if (/[<>&"\\`]/.test(texte))
    return `${champ} : les caractères < > & " \\ \` ne sont pas acceptés.`;
  return null;
}

function listerFichiers(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    if (DOSSIERS_EXCLUS.has(entree.name)) return [];
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return listerFichiers(chemin);
    return entree.isFile() ? [chemin] : [];
  });
}

function contientDuBinaire(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

// Échappe le nom affiché selon le langage du fichier où il est inséré : il y
// arrive toujours à l'intérieur d'une chaîne existante.
function echapperPour(chemin, texte) {
  if (chemin.endsWith('.sql')) return texte.replaceAll("'", "''");
  if (chemin.endsWith('.json') || chemin.endsWith('.webmanifest'))
    return JSON.stringify(texte).slice(1, -1);
  return texte;
}

function majusculeInitiale(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function remplacer(chemin, contenu, id, nom, slogan) {
  if (FICHIERS_TECHNIQUES.has(chemin)) return contenu.replaceAll(ANCIEN_NOM, id);

  let resultat = contenu;
  if (chemin === 'supabase/config.toml') {
    resultat = resultat.replace(`project_id = "${ANCIEN_NOM}"`, `project_id = "${id}"`);
  }
  if (slogan) {
    resultat = resultat
      .replaceAll(ANCIENNE_DESCRIPTION, echapperPour(chemin, `${majusculeInitiale(slogan)}.`))
      .replaceAll(ANCIEN_SLOGAN, echapperPour(chemin, slogan));
  }
  return resultat.replaceAll(ANCIEN_NOM, echapperPour(chemin, nom));
}

async function demander() {
  // Arguments passés en ligne de commande : aucune question (usage scripté).
  if (options.id)
    return { id: options.id, nom: options.nom ?? options.id, slogan: options.slogan ?? '' };
  // Entrée redirigée (printf … | npm run init-template) : readline perd les
  // lignes arrivées avant la question, on lit donc tout d'avance.
  const lignes = process.stdin.isTTY ? null : readFileSync(0, 'utf8').split(/\r?\n/);
  const rl = lignes ? null : createInterface({ input: process.stdin, output: process.stdout });
  const lire = async (invite) => (lignes ? (lignes.shift() ?? null) : rl.question(invite));
  const poser = async (question, valider, defaut) => {
    for (;;) {
      const suffixe = defaut ? ` [${defaut}]` : '';
      const brute = await lire(`${question}${suffixe} : `);
      if (brute === null) erreur(`réponse manquante : ${question}.`);
      const reponse = brute.trim() || defaut || '';
      const probleme = valider(reponse);
      if (!probleme) return reponse;
      if (lignes) erreur(probleme);
      console.log(`  ${probleme}`);
    }
  };
  const id = await poser('Identifiant technique (ex. covoitjazz)', validerId);
  const nom = await poser("Nom affiché de l'app", (t) => validerTexte(t, 'Nom'), id);
  const slogan = await poser('Slogan (vide pour garder « le covoiturage musical »)', (t) =>
    t ? validerTexte(t, 'Slogan') : null,
  );
  rl?.close();
  return { id, nom, slogan };
}

const fichiers = listerFichiers(root)
  .map((absolu) => ({ absolu, chemin: relative(root, absolu).split('\\').join('/') }))
  .filter(({ chemin }) => !FICHIERS_EXCLUS.has(chemin));
if (!fichiers.some(({ absolu }) => readFileSync(absolu).includes(ANCIEN_NOM))) {
  erreur(`« ${ANCIEN_NOM} » introuvable : le template semble déjà initialisé.`);
}

const { id, nom, slogan } = await demander();
for (const probleme of [
  validerId(id),
  validerTexte(nom, 'Nom'),
  slogan ? validerTexte(slogan, 'Slogan') : null,
]) {
  if (probleme) erreur(probleme);
}

const modifications = [];
for (const { absolu, chemin } of fichiers) {
  const buffer = readFileSync(absolu);
  if (contientDuBinaire(buffer)) continue;
  const contenu = buffer.toString('utf8');
  if (!contenu.includes(ANCIEN_NOM) && !(slogan && contenu.includes(ANCIEN_SLOGAN))) continue;
  const nouveau = remplacer(chemin, contenu, id, nom, slogan);
  if (nouveau !== contenu) modifications.push({ absolu, chemin, nouveau });
}

// README : seul le compte de démo (généré par seed.sql) doit suivre.
const readme = join(root, 'README.md');
const contenuReadme = readFileSync(readme, 'utf8');
const compteDemo = `admin@${ANCIEN_NOM}.local`;
if (contenuReadme.includes(compteDemo)) {
  modifications.push({
    absolu: readme,
    chemin: 'README.md',
    nouveau: contenuReadme.replaceAll(compteDemo, `admin@${id}.local`),
  });
}

console.log(`\n${options['dry-run'] ? 'Fichiers qui seraient modifiés' : 'Fichiers modifiés'} :`);
for (const { absolu, chemin, nouveau } of modifications) {
  if (!options['dry-run']) writeFileSync(absolu, nouveau);
  console.log(`  ${chemin}`);
}

console.log(`
Reste à faire à la main :
  - remplacer les visuels de public/ (mêmes noms, mêmes dimensions — README § Remplacer le logo) ;
  - (optionnel) couleurs : theme-color de src/index.html et public/site.webmanifest ;
  - vérifier : npm run setup && npm start, puis un email de confirmation dans Mailpit.
Compte de démo local : admin@${id}.local / password123`);
