#!/usr/bin/env node
// Met en route un poste de dev complet en une seule commande, juste après un
// `git clone` : installe les dépendances npm, démarre le stack Supabase local
// (Docker — migrations + seed rejoués automatiquement, cf. supabase/), puis
// génère src/environments/environment.development.ts à partir de son URL et
// de sa clé publique. Ne touche jamais à environment.ts s'il existe déjà (il
// contient les vraies valeurs du projet Supabase de prod, à configurer à la
// main — voir README § Déploiement).
//
// Usage : node setup-local.mjs   (ou npm run setup)
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const devEnvPath = fileURLToPath(new URL('src/environments/environment.development.ts', import.meta.url));
const prodEnvPath = fileURLToPath(new URL('src/environments/environment.ts', import.meta.url));

function run(cmd, args) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`\n✗ Échec de : ${cmd} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

function environmentFileContent(production, apiUrl, anonKey) {
  return `export const environment = {
  production: ${production},
  supabaseUrl: '${apiUrl}',
  supabaseAnonKey: '${anonKey}',
};
`;
}

if (!existsSync(new URL('node_modules', import.meta.url))) {
  run('npm', ['install']);
} else {
  console.log('… node_modules déjà présent, npm install sauté.');
}

run('npx', ['supabase', 'start']);

console.log('\n→ Lecture de la configuration du stack local (supabase status)...');
const statusResult = spawnSync('npx', ['supabase', 'status', '--output', 'json'], {
  cwd: root,
  encoding: 'utf-8',
});
if (statusResult.status !== 0) {
  console.error(statusResult.stderr || statusResult.stdout);
  process.exit(statusResult.status ?? 1);
}

let status;
try {
  status = JSON.parse(statusResult.stdout);
} catch {
  console.error("✗ Impossible de lire la sortie JSON de `supabase status` :\n" + statusResult.stdout);
  process.exit(1);
}

const anonKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

writeFileSync(devEnvPath, environmentFileContent(false, status.API_URL, anonKey));
console.log(`✓ ${devEnvPath} généré (pointe vers le stack local).`);

if (!existsSync(prodEnvPath)) {
  // N'existe pas encore : on le crée avec les valeurs locales pour que le
  // projet compile (import direct dans le code), à remplacer par les
  // vraies valeurs du projet Supabase avant un `npm run build` de prod.
  writeFileSync(prodEnvPath, environmentFileContent(true, status.API_URL, anonKey));
  console.log(`✓ ${prodEnvPath} généré avec des valeurs locales — à remplacer avant un vrai build de prod (voir README § Déploiement).`);
} else {
  console.log(`… ${prodEnvPath} existe déjà, laissé inchangé.`);
}

console.log(`
Stack Supabase local prêt :
  Studio   ${status.STUDIO_URL}
  Mailpit  ${status.MAILPIT_URL ?? status.INBUCKET_URL}
  Compte de démo : admin@bazbazcar.local / password123

→ npm start
`);
