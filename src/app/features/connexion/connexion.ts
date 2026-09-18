import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-connexion',
  imports: [FormsModule, RouterLink, Header],
  templateUrl: './connexion.html',
})
export class Connexion {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly motDePasse = signal('');

  readonly loading = signal(false);
  readonly erreur = signal<string | null>(null);

  async submit(): Promise<void> {
    this.erreur.set(null);
    this.loading.set(true);

    const { error } = await this.auth.signIn(this.email(), this.motDePasse());

    this.loading.set(false);

    if (error) {
      this.erreur.set(error);
      return;
    }

    const destination = this.auth.profile()?.statut === 'valide' ? '/accueil' : '/en-attente';
    this.router.navigateByUrl(destination);
  }
}
