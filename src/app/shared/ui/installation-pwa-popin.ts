import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { PwaInstall } from '../../core/pwa/pwa-install';

const POPIN_ID = 'popin-installation-pwa';

// Popin proposant d'installer l'app (PWA) au membre connecté, tant qu'elle n'est
// pas déjà installée — cf. PwaInstall pour la détection et le report. Toute
// fermeture (Plus tard, ✕, Échap, clic hors de la popin) reporte la proposition.
@Component({
  selector: 'app-installation-pwa-popin',
  templateUrl: './installation-pwa-popin.html',
})
export class InstallationPwaPopin {
  protected readonly pwa = inject(PwaInstall);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly popinId = POPIN_ID;

  // `null` tant que la première navigation n'est pas terminée : on ne sait pas
  // encore sur quelle page le membre atterrit.
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: null },
  );

  // Un membre invité (ou qui réinitialise son mot de passe) arrive sur
  // /nouveau-mot-de-passe avec une session déjà ouverte : pas de modale par-dessus
  // le formulaire où il choisit son mot de passe, la popin viendra à la page suivante.
  private readonly peutSAfficher = computed(() => {
    const url = this.url();
    return (
      this.auth.profile()?.statut === 'valide' &&
      url !== null &&
      !url.startsWith('/nouveau-mot-de-passe')
    );
  });

  constructor() {
    effect(() => {
      if (this.peutSAfficher() && this.pwa.mode()) {
        j6n.openModal(POPIN_ID);
      }
    });
  }

  installer(): void {
    // prompt() doit partir pendant le geste utilisateur : on le lance avant de fermer la popin.
    this.pwa.installer();
    j6n.closeModal(POPIN_ID);
  }
}
