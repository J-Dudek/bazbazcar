import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Role } from '../../shared/models/profile';
import { Header } from '../../shared/ui/header';

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

@Component({
  selector: 'app-invitation',
  imports: [FormsModule, Header],
  templateUrl: './invitation.html',
})
export class Invitation {
  private readonly supabase = inject(SupabaseService).client;

  readonly emailsTexte = signal('');
  readonly role = signal<Role>('membre');
  readonly loading = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly resultats = signal<InviteResult[]>([]);

  async submit(): Promise<void> {
    this.erreur.set(null);
    this.resultats.set([]);

    const emails = [
      ...new Set(
        this.emailsTexte()
          .split(/[\n,;]/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0),
      ),
    ];

    if (emails.length === 0) {
      this.erreur.set('Indique au moins une adresse email.');
      return;
    }

    this.loading.set(true);

    const { data, error } = await this.supabase.functions.invoke('invite-membres', {
      body: {
        emails,
        role: this.role(),
        redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
      },
    });

    this.loading.set(false);

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        this.erreur.set(body?.error ?? error.message);
      } else {
        this.erreur.set(error.message);
      }
      return;
    }

    this.resultats.set((data?.results ?? []) as InviteResult[]);
    if (data?.results?.every((r: InviteResult) => r.success)) {
      this.emailsTexte.set('');
    }
  }
}
