import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, fromEvent } from 'rxjs';
import { Auth } from '../auth/auth';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Nombre de comptes en attente d'activation, pour la pastille du header.
 *
 * Ne concerne que les administrateurs validés : eux seuls peuvent lire tous les
 * profils (RLS `profiles_select_admin`), et eux seuls ont le lien « Gérer les
 * membres ». Pour tout autre utilisateur, le nombre reste à 0 sans requête : un
 * membre ne verrait qu'une partie des profils (le sien, ceux de ses
 * co-voitureurs), le comptage serait faux.
 */
@Injectable({ providedIn: 'root' })
export class MembresEnAttente {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(Auth);

  private readonly _nombre = signal(0);
  readonly nombre = this._nombre.asReadonly();

  // Numéro de la dernière requête lancée : une réponse plus ancienne qui arrive
  // après une plus récente (réseau lent, deux rafraîchissements rapprochés) est
  // ignorée, sinon elle réécrirait un nombre périmé.
  private derniereRequete = 0;

  constructor() {
    // Connexion, déconnexion, changement de rôle ou de statut : le profil change.
    effect(() => {
      this.auth.profile();
      untracked(() => void this.rafraichir());
    });

    // Un compte a pu être créé depuis la dernière page vue.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.rafraichir());

    // App installée (PWA) rouverte après des heures : aucune navigation n'a lieu,
    // mais de nouveaux comptes ont pu arriver entre-temps.
    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.rafraichir());
  }

  async rafraichir(): Promise<void> {
    const requete = ++this.derniereRequete;
    const profil = this.auth.profile();

    if (profil?.role !== 'admin' || profil.statut !== 'valide') {
      this._nombre.set(0);
      return;
    }

    const { count, error } = await this.supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_attente');

    // Réseau coupé, session expirée... : on garde le dernier nombre connu plutôt
    // que de faire disparaître la pastille sur une erreur passagère.
    if (!error && requete === this.derniereRequete) {
      this._nombre.set(count ?? 0);
    }
  }
}
