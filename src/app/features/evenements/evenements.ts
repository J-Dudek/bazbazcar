import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Evenement } from '../../shared/models/evenement';

@Component({
  selector: 'app-evenements',
  imports: [DatePipe, RouterLink],
  templateUrl: './evenements.html',
})
export class Evenements implements OnInit {
  private readonly supabase = inject(SupabaseService).client;

  readonly evenements = signal<Evenement[]>([]);
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const { data, error } = await this.supabase
      .from('evenements')
      .select('*')
      .order('date_evenement', { ascending: true });

    this.loading.set(false);

    if (error) {
      this.erreur.set(error.message);
      return;
    }

    this.evenements.set(this.trierParProximite(data as Evenement[]));
  }

  estPasse(evenement: Evenement): boolean {
    return evenement.date_evenement < new Date().toISOString().slice(0, 10);
  }

  private trierParProximite(evenements: Evenement[]): Evenement[] {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const aVenir = evenements
      .filter((e) => e.date_evenement >= aujourdhui)
      .sort((a, b) => a.date_evenement.localeCompare(b.date_evenement));
    const passes = evenements
      .filter((e) => e.date_evenement < aujourdhui)
      .sort((a, b) => b.date_evenement.localeCompare(a.date_evenement));

    return [...aVenir, ...passes];
  }
}
