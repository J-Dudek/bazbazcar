import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Auth } from '../../core/auth/auth';
import { Evenement } from '../models/evenement';

const POPIN_ID = 'popin-nouvel-evenement';

// Popin affichée en temps réel (Supabase Realtime) aux membres déjà connectés
// quand un admin publie un nouvel événement — cf. migration
// 0018_realtime_evenements.sql. La RLS de `evenements` (lecture réservée aux
// membres validés/admins) s'applique déjà à la diffusion Realtime : aucun
// membre en attente ne peut recevoir cet évènement, pas de vérif en plus ici.
@Component({
  selector: 'app-nouvel-evenement-popin',
  imports: [DatePipe],
  templateUrl: './nouvel-evenement-popin.html',
})
export class NouvelEvenementPopin {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly popinId = POPIN_ID;
  readonly evenement = signal<Evenement | null>(null);

  private channel: RealtimeChannel | null = null;

  constructor() {
    effect((onCleanup) => {
      const userId = this.auth.session()?.user.id;
      const estValide = this.auth.profile()?.statut === 'valide';

      if (userId && estValide) {
        this.souscrire(userId);
      }

      onCleanup(() => this.desouscrire());
    });
  }

  private souscrire(userId: string): void {
    this.channel = this.supabase
      .channel('evenements-nouveaux')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'evenements' },
        ({ new: ligne }) => {
          const evt = ligne as Evenement;
          // Pas de popin pour l'admin qui vient de créer l'événement
          // lui-même (même exclusion que l'email de notification, 0017).
          if (evt.created_by === userId) {
            return;
          }
          this.evenement.set(evt);
          j6n.openModal(POPIN_ID);
        },
      )
      .subscribe();
  }

  private desouscrire(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  voir(): void {
    const evt = this.evenement();
    if (!evt) {
      return;
    }
    j6n.closeModal(POPIN_ID);
    this.router.navigate(['/evenements', evt.id]);
  }
}
