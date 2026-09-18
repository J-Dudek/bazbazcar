import { Routes } from '@angular/router';
import { adminGuard, authGuard, homeGuard, validatedGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [homeGuard],
    loadComponent: () => import('./features/inscription/inscription').then((m) => m.Inscription),
  },
  {
    path: 'inscription',
    loadComponent: () => import('./features/inscription/inscription').then((m) => m.Inscription),
  },
  {
    path: 'connexion',
    loadComponent: () => import('./features/connexion/connexion').then((m) => m.Connexion),
  },
  {
    path: 'mot-de-passe-oublie',
    loadComponent: () =>
      import('./features/connexion/mot-de-passe-oublie').then((m) => m.MotDePasseOublie),
  },
  {
    path: 'nouveau-mot-de-passe',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/connexion/nouveau-mot-de-passe').then((m) => m.NouveauMotDePasse),
  },
  {
    path: 'en-attente',
    canActivate: [authGuard],
    loadComponent: () => import('./features/inscription/en-attente').then((m) => m.EnAttente),
  },
  {
    path: 'mon-compte',
    canActivate: [authGuard],
    loadComponent: () => import('./features/compte/mon-compte').then((m) => m.MonCompte),
  },
  {
    path: 'accueil',
    canActivate: [validatedGuard],
    loadComponent: () => import('./features/accueil/accueil').then((m) => m.Accueil),
  },
  {
    path: 'evenements',
    canActivate: [validatedGuard],
    loadComponent: () => import('./features/evenements/evenements').then((m) => m.Evenements),
  },
  {
    path: 'evenements/:id',
    canActivate: [validatedGuard],
    loadComponent: () =>
      import('./features/evenements/evenement-detail').then((m) => m.EvenementDetail),
  },
  {
    path: 'admin/evenements/nouveau',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/evenement-form').then((m) => m.EvenementForm),
  },
  {
    path: 'admin/evenements/:id/modifier',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/evenement-form').then((m) => m.EvenementForm),
  },
  {
    path: 'admin/inviter',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/invitation').then((m) => m.Invitation),
  },
  {
    path: 'admin/membres',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/membres').then((m) => m.Membres),
  },
  {
    path: 'admin/statistiques',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/statistiques').then((m) => m.Statistiques),
  },
];
