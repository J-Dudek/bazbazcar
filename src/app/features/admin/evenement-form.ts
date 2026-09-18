import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-evenement-form',
  imports: [FormsModule],
  templateUrl: './evenement-form.html',
})
export class EvenementForm implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private evenementId: string | null = null;

  readonly titre = signal('');
  readonly dateEvenement = signal('');
  readonly lieu = signal('');
  readonly horaireRdv = signal('');

  readonly chargement = signal(false);
  readonly loading = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly suppressionEnCours = signal(false);
  readonly suppressionErreur = signal<string | null>(null);

  get modeEdition(): boolean {
    return this.evenementId !== null;
  }

  async ngOnInit(): Promise<void> {
    this.evenementId = this.route.snapshot.paramMap.get('id');
    if (!this.evenementId) {
      return;
    }

    this.chargement.set(true);

    const { data, error } = await this.supabase
      .from('evenements')
      .select('*')
      .eq('id', this.evenementId)
      .single();

    this.chargement.set(false);

    if (error || !data) {
      this.erreur.set(error?.message ?? 'Événement introuvable');
      return;
    }

    this.titre.set(data['titre']);
    this.dateEvenement.set(data['date_evenement']);
    this.lieu.set(data['lieu']);
    this.horaireRdv.set((data['horaire_rdv'] as string).slice(0, 5));
  }

  async submit(): Promise<void> {
    this.erreur.set(null);

    const payload = {
      titre: this.titre(),
      date_evenement: this.dateEvenement(),
      lieu: this.lieu(),
      horaire_rdv: this.horaireRdv(),
    };

    this.loading.set(true);

    const { error } = this.evenementId
      ? await this.supabase.from('evenements').update(payload).eq('id', this.evenementId)
      : await this.supabase.from('evenements').insert({
          ...payload,
          created_by: this.auth.session()?.user.id,
        });

    this.loading.set(false);

    if (error) {
      this.erreur.set(error.message);
      return;
    }

    await this.router.navigateByUrl(
      this.evenementId ? `/evenements/${this.evenementId}` : '/evenements',
    );
  }

  async supprimerEvenement(): Promise<void> {
    if (
      !confirm(
        'Supprimer définitivement cet événement ? Les trajets, inscriptions et commentaires associés seront supprimés avec lui.',
      )
    ) {
      return;
    }

    this.suppressionErreur.set(null);
    this.suppressionEnCours.set(true);

    const { error } = await this.supabase.from('evenements').delete().eq('id', this.evenementId!);

    this.suppressionEnCours.set(false);

    if (error) {
      this.suppressionErreur.set(error.message);
      return;
    }

    await this.router.navigateByUrl('/evenements');
  }
}
