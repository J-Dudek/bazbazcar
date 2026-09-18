import { Component, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
})
export class Header {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // Le header est monté une seule fois par app.html, donc avant que les guards
  // aient attendu `auth.initialized` : sans cette garde, un membre connecté qui
  // recharge la page verrait brièvement « Connexion / Inscription » avant son menu.
  protected readonly ready = signal(false);

  constructor() {
    this.auth.initialized.then(() => this.ready.set(true));

    // theme.js ne referme le menu mobile qu'au clic sur un lien ou hors du menu.
    // Le header n'étant plus recréé à chaque page, on le referme nous-mêmes à
    // chaque navigation (déconnexion, retour arrière...), sinon il resterait ouvert.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.fermerMenu());
  }

  async seDeconnecter(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/connexion');
  }

  /** Même contrat DOM que `initMenuToggle` dans theme.js (classe `is-open` + `aria-expanded`). */
  private fermerMenu(): void {
    const header = this.host.nativeElement;
    header.querySelector('.j6n-nav')?.classList.remove('is-open');
    header.querySelector('[data-j6n-js="menu-toggle"]')?.setAttribute('aria-expanded', 'false');
  }
}
