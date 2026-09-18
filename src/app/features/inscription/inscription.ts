import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-inscription',
  imports: [FormsModule, RouterLink],
  templateUrl: './inscription.html',
})
export class Inscription {
  private readonly auth = inject(Auth);

  readonly prenom = signal('');
  readonly nom = signal('');
  readonly email = signal('');
  readonly motDePasse = signal('');

  readonly loading = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly succes = signal(false);

  async submit(): Promise<void> {
    this.erreur.set(null);
    this.loading.set(true);

    const { error } = await this.auth.signUp(
      this.nom(),
      this.prenom(),
      this.email(),
      this.motDePasse(),
    );

    this.loading.set(false);

    if (error) {
      this.erreur.set(error);
      return;
    }

    this.succes.set(true);
  }
}
