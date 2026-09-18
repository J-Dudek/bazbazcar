import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-nouveau-mot-de-passe',
  imports: [FormsModule],
  templateUrl: './nouveau-mot-de-passe.html',
})
export class NouveauMotDePasse {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly motDePasse = signal('');
  readonly confirmation = signal('');
  readonly loading = signal(false);
  readonly erreur = signal<string | null>(null);

  async submit(): Promise<void> {
    this.erreur.set(null);

    if (this.motDePasse() !== this.confirmation()) {
      this.erreur.set('Les deux mots de passe ne correspondent pas.');
      return;
    }

    this.loading.set(true);
    const { error } = await this.auth.updatePassword(this.motDePasse());
    this.loading.set(false);

    if (error) {
      this.erreur.set(error);
      return;
    }

    const destination = this.auth.profile()?.statut === 'valide' ? '/accueil' : '/en-attente';
    this.router.navigateByUrl(destination);
  }
}
