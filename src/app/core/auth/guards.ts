import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.initialized;

  if (auth.session()) {
    return true;
  }
  return router.parseUrl('/connexion');
};

export const validatedGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.initialized;

  if (!auth.session()) {
    return router.parseUrl('/connexion');
  }
  if (auth.profile()?.statut === 'valide') {
    return true;
  }
  return router.parseUrl('/en-attente');
};

/** Route racine `/` : redirige selon l'état de connexion plutôt qu'un `redirectTo` statique
 * (sinon un utilisateur connecté qui clique le logo atterrit sur le formulaire d'inscription,
 * ce qui donne l'impression d'être déconnecté). */
export const homeGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.initialized;

  if (!auth.session()) {
    return router.parseUrl('/inscription');
  }
  if (auth.profile()?.statut === 'valide') {
    return router.parseUrl('/accueil');
  }
  return router.parseUrl('/en-attente');
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.initialized;

  if (auth.profile()?.role === 'admin') {
    return true;
  }
  return router.parseUrl('/');
};
