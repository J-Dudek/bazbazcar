import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-mot-de-passe-oublie',
  imports: [FormsModule, RouterLink, Header],
  templateUrl: './mot-de-passe-oublie.html',
})
export class MotDePasseOublie {
  private readonly auth = inject(Auth);

  readonly email = signal('');
  readonly loading = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly envoye = signal(false);

  async submit(): Promise<void> {
    this.erreur.set(null);
    this.loading.set(true);

    const { error } = await this.auth.resetPasswordForEmail(this.email());

    this.loading.set(false);

    if (error) {
      this.erreur.set(error);
      return;
    }

    this.envoye.set(true);
  }
}
