import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Auth } from '../../core/auth/auth';
import { Profile, Role, Statut } from '../../shared/models/profile';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-membres',
  imports: [FormsModule, Header],
  templateUrl: './membres.html',
})
export class Membres implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  protected readonly auth = inject(Auth);

  readonly membres = signal<Profile[]>([]);
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly enCours = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.charger();
  }

  private async charger(): Promise<void> {
    this.loading.set(true);
    this.erreur.set(null);

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    this.loading.set(false);

    if (error) {
      this.erreur.set(error.message);
      return;
    }

    this.membres.set((data ?? []) as Profile[]);
  }

  async changerRole(membre: Profile, role: Role): Promise<void> {
    const estMoiMeme = membre.id === this.auth.session()?.user.id;
    if (estMoiMeme && role !== 'admin') {
      if (
        !confirm('Tu es sur le point de retirer tes propres droits administrateur. Confirmer ?')
      ) {
        await this.charger();
        return;
      }
    }

    await this.mettreAJour(membre, { role });
  }

  async changerStatut(membre: Profile, statut: Statut): Promise<void> {
    await this.mettreAJour(membre, { statut });
  }

  private async mettreAJour(
    membre: Profile,
    patch: Partial<Pick<Profile, 'role' | 'statut'>>,
  ): Promise<void> {
    this.enCours.set(membre.id);

    const { error } = await this.supabase.from('profiles').update(patch).eq('id', membre.id);

    this.enCours.set(null);

    if (error) {
      j6n.toast(error.message, { tone: 'danger' });
      await this.charger();
      return;
    }

    j6n.toast('Compte mis à jour.', { tone: 'success' });
    await this.charger();
  }
}
