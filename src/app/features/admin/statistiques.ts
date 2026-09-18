import { Component, OnInit, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';

interface StatMembre {
  id: string;
  nom: string;
  prenom: string;
  nb_trajets_proposes: number;
  nb_places_proposees: number;
  nb_trajets_rejoints: number;
}

@Component({
  selector: 'app-statistiques',
  templateUrl: './statistiques.html',
})
export class Statistiques implements OnInit {
  private readonly supabase = inject(SupabaseService).client;

  readonly stats = signal<StatMembre[]>([]);
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const { data, error } = await this.supabase.rpc('statistiques_membres');

    this.loading.set(false);

    if (error) {
      this.erreur.set(error.message);
      return;
    }

    this.stats.set((data ?? []) as StatMembre[]);
  }
}
