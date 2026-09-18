import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Auth } from '../../core/auth/auth';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-mon-compte',
  imports: [FormsModule, Header],
  templateUrl: './mon-compte.html',
})
export class MonCompte {
  private readonly supabase = inject(SupabaseService).client;
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly prenom = signal(this.auth.profile()?.prenom ?? '');
  readonly nom = signal(this.auth.profile()?.nom ?? '');
  readonly identiteEnCours = signal(false);
  readonly identiteErreur = signal<string | null>(null);
  readonly identiteSucces = signal(false);

  readonly nouveauMotDePasse = signal('');
  readonly confirmationMotDePasse = signal('');
  readonly motDePasseEnCours = signal(false);
  readonly motDePasseErreur = signal<string | null>(null);
  readonly motDePasseSucces = signal(false);

  readonly suppressionEnCours = signal(false);
  readonly suppressionErreur = signal<string | null>(null);

  async enregistrerIdentite(): Promise<void> {
    this.identiteErreur.set(null);
    this.identiteSucces.set(false);

    const userId = this.auth.session()?.user.id;
    if (!userId) {
      return;
    }

    this.identiteEnCours.set(true);

    const { error } = await this.supabase
      .from('profiles')
      .update({ prenom: this.prenom(), nom: this.nom() })
      .eq('id', userId);

    this.identiteEnCours.set(false);

    if (error) {
      this.identiteErreur.set(error.message);
      return;
    }

    await this.auth.rafraichirProfil();
    this.identiteSucces.set(true);
  }

  async changerMotDePasse(): Promise<void> {
    this.motDePasseErreur.set(null);
    this.motDePasseSucces.set(false);

    if (this.nouveauMotDePasse() !== this.confirmationMotDePasse()) {
      this.motDePasseErreur.set('Les deux mots de passe ne correspondent pas.');
      return;
    }

    this.motDePasseEnCours.set(true);
    const { error } = await this.auth.updatePassword(this.nouveauMotDePasse());
    this.motDePasseEnCours.set(false);

    if (error) {
      this.motDePasseErreur.set(error);
      return;
    }

    this.nouveauMotDePasse.set('');
    this.confirmationMotDePasse.set('');
    this.motDePasseSucces.set(true);
  }

  async supprimerCompte(): Promise<void> {
    if (!confirm('Supprimer définitivement ton compte ? Cette action est irréversible.')) {
      return;
    }

    this.suppressionErreur.set(null);
    this.suppressionEnCours.set(true);

    const { error } = await this.supabase.functions.invoke('supprimer-mon-compte');

    this.suppressionEnCours.set(false);

    if (error) {
      this.suppressionErreur.set(await this.messageErreurFonction(error));
      return;
    }

    await this.auth.signOut();
    this.router.navigateByUrl('/connexion');
  }

  /** `functions.invoke` ne met le message d'erreur métier (JSON renvoyé par la
   * fonction) que dans `error.context`, pas dans `error.message` — sinon on
   * affiche juste "Edge Function returned a non-2xx status code". */
  private async messageErreurFonction(error: unknown): Promise<string> {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) {
        return body.error as string;
      }
    }
    return error instanceof Error ? error.message : 'Erreur inconnue';
  }
}
