// Copier ce fichier vers environment.ts (prod) et environment.development.ts (dev),
// puis renseigner les valeurs réelles. Ces deux fichiers générés sont gitignorés :
// ne jamais y mettre la clé service_role, seulement l'URL du projet et l'anon key.
export const environment = {
  production: false,
  supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
  supabaseAnonKey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};
