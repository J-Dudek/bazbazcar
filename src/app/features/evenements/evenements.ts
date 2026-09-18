import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Evenement } from '../../shared/models/evenement';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-evenements',
  imports: [DatePipe, RouterLink, Header],
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

    this.evenements.set(data as Evenement[]);
  }
}
