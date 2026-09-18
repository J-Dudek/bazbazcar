// Génère src/environments/environment.ts à partir de variables d'environnement
// du pipeline de build (Netlify, GitHub Actions...) — voir CLAUDE.md §7.4.
// Ce fichier n'est jamais versionné (cf. .gitignore) ; environment.template.ts
// documente sa forme. En local, on le crée soi-même une fois à la main.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies dans les variables ' +
      "d'environnement du pipeline de build (Netlify : Site settings → Environment variables).",
  );
  process.exit(1);
}

const contenu = `export const environment = {
  production: true,
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
};
`;

const cible = fileURLToPath(new URL('../src/environments/environment.ts', import.meta.url));
writeFileSync(cible, contenu);
console.log(`environment.ts généré (${cible}).`);
