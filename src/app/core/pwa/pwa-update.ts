import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/**
 * Angular télécharge une nouvelle version en tâche de fond mais ne l'active
 * qu'au prochain rechargement complet — sur une PWA ouverte depuis l'écran
 * d'accueil et jamais fermée, ce rechargement peut ne jamais arriver. On
 * prévient et on laisse recharger d'un tap sur le toast : pas de rechargement
 * forcé, ça perdrait un formulaire en cours de saisie.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdate {
  private readonly swUpdate = inject(SwUpdate);

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.prevenir());

    // `registrationStrategy` (app.config.ts) ne vérifie une nouvelle version
    // qu'au démarrage de l'app : sur une PWA laissée ouverte plusieurs jours,
    // on redéclenche la vérification à chaque retour au premier plan.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.swUpdate.checkForUpdate();
      }
    });
  }

  private prevenir(): void {
    const toast = j6n.toast('Nouvelle version disponible — appuie pour recharger.', {
      duration: 0,
    });
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => document.location.reload());
  }
}
